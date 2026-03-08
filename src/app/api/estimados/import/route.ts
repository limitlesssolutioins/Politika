import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';
// @ts-expect-error - pdf-parse types are not perfect with ESM/CJS interop in Next.js
import pdfParse from 'pdf-parse';

// Configuración de Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

function normalizeString(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' ');
}

// 1. Detección de columnas (Excel/CSV)
async function detectColumnsWithAI(data: any[][]) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { headerRowIdx: -1, puestoColIdx: -1, votosColIdx: null };

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const sampleData = data.slice(0, 15);
    const prompt = `
Analiza las siguientes filas de una tabla. Identifica los índices (empezando en 0):
1. El "Puesto de Votación", "Lugar de Votación", "Puesto", etc.
2. La "Cantidad de Votos" o "Potencial Electoral". Si es una lista de votantes (1 fila = 1 voto), "votosColIdx": null.
Si no encuentras el puesto, "puestoColIdx": null. Indica "headerRowIdx" (índice de fila de los encabezados).
Devuelve SOLO JSON válido sin texto adicional.
Ejemplo: {"headerRowIdx": 0, "puestoColIdx": 2, "votosColIdx": null}
Datos: ${JSON.stringify(sampleData)}
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return { headerRowIdx: -1, puestoColIdx: -1, votosColIdx: null };
  } catch (error) {
    console.error("Error AI (Excel):", error);
    return { headerRowIdx: -1, puestoColIdx: -1, votosColIdx: null };
  }
}

// 2. Procesamiento MultiModal (Imágenes/PDFs) con Gemini Vision
async function processImageOrPdfWithAI(file: File): Promise<any[][] | null> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY no configurada.");

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const buffer = Buffer.from(await file.arrayBuffer());
    
    let base64Data = buffer.toString("base64");
    let mimeType = file.type;

    // Si es PDF y falla el modelo multimodal, extraemos texto manualmente
    let pdfText = "";
    if (file.type === 'application/pdf') {
       const parsed = await pdfParse(buffer);
       pdfText = parsed.text;
    }

    const prompt = `
Eres un analista de datos. Te estoy enviando un archivo electoral (imagen o documento).
Necesito que extraigas TODA la información de la tabla que contiene y la devuelvas como un arreglo JSON (Array de Arrays), equivalente a una hoja de Excel.
Si hay texto antes o después de la tabla, ignóralo. Solo quiero la tabla pura.
La primera fila (array) debe contener los nombres de las columnas.
Formato esperado: [ ["Puesto de Votación", "Mesa", "Votos"], ["Colegio 1", "1", "100"] ]
Devuelve ÚNICAMENTE el arreglo JSON. No uses markdown.

Aquí está el contenido (Si es PDF, se usa el texto extraído; si es imagen, usa la imagen adjunta):
${pdfText ? `Texto extraído del PDF:\n${pdfText}` : ""}
    `;

    let result;
    if (pdfText) {
        // Enviar solo texto para PDF parseado
        result = await model.generateContent(prompt);
    } else {
        // Enviar imagen (multimodal)
        result = await model.generateContent([
            prompt,
            {
                inlineData: {
                data: base64Data,
                mimeType: mimeType
                }
            }
        ]);
    }

    const text = result.response.text().trim();
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
        const parsed = JSON.parse(arrayMatch[0]);
        if (Array.isArray(parsed) && Array.isArray(parsed[0])) {
            return parsed;
        }
    }
    return null;
  } catch (error) {
    console.error("Error AI (Vision/PDF):", error);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];
    
    // Nuevo parámetro: "action" -> puede ser 'preview' o 'commit'
    const action = formData.get('action') as string || 'commit';

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No se enviaron archivos' }, { status: 400 });
    }

    const puestos = await prisma.puesto.findMany();
    const puestoMap = new Map<string, typeof puestos[0]>();
    puestos.forEach(p => {
      puestoMap.set(normalizeString(p.nombre), p);
    });

    const conteoPorPuestoId: Record<number, number> = {};
    const unmatched: Record<string, number> = {};
    let totalRows = 0;
    let totalMatched = 0;
    const fileResults: any[] = [];
    const previewData: any[] = [];

    for (const file of files) {
      try {
        let data: any[][] | null = null;
        
        // --- 1. Determinar el tipo de archivo y extraer los datos ---
        const ext = file.name.split('.').pop()?.toLowerCase();
        
        if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
           const bytes = await file.arrayBuffer();
           const buffer = Buffer.from(bytes);
           const workbook = XLSX.read(buffer, { type: 'buffer' });
           const worksheet = workbook.Sheets[workbook.SheetNames[0]];
           data = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false }) as any[][];
        } else if (file.type.startsWith('image/') || ext === 'pdf') {
           data = await processImageOrPdfWithAI(file);
        } else {
           fileResults.push({ name: file.name, error: 'Formato no soportado.' });
           continue;
        }

        if (!data || data.length === 0) {
          fileResults.push({ name: file.name, error: 'No se pudo extraer la tabla o el archivo está vacío.' });
          continue;
        }
        
        // --- 2. IA OBTENCIÓN DE COLUMNAS ---
        let { headerRowIdx, puestoColIdx, votosColIdx } = await detectColumnsWithAI(data);
        
        // Fallback manual
        if (puestoColIdx === null || puestoColIdx === -1) {
          for (let i = 0; i < Math.min(10, data.length); i++) {
            const row = data[i];
            if (!row) continue;
            for (let j = 0; j < row.length; j++) {
              const cellStr = normalizeString(String(row[j] || ''));
              if (cellStr.includes('PUESTO') || cellStr.includes('LUGAR') || cellStr.includes('CENTRO')) {
                headerRowIdx = i;
                puestoColIdx = j;
                break;
              }
            }
            if (headerRowIdx !== -1) break;
          }
        }
        
        if (puestoColIdx === null || puestoColIdx === -1) {
          fileResults.push({ name: file.name, error: 'No se encontró la columna de Puesto de Votación.' });
          continue;
        }
        
        const startIndex = headerRowIdx !== null && headerRowIdx >= 0 ? headerRowIdx + 1 : 1;
        
        let fileRows = 0;
        let fileMatched = 0;

        for (let i = startIndex; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length === 0) continue;
          
          const puestoValue = String(row[puestoColIdx] || '');
          if (!puestoValue || puestoValue.trim() === '') continue;
          
          let cleanPuestoValue = normalizeString(puestoValue);
          cleanPuestoValue = cleanPuestoValue.replace(/ MESA \d+/g, '').replace(/ MSA \d+/g, '').trim();
          
          totalRows++;
          fileRows++;
          
          let match = puestoMap.get(cleanPuestoValue);
          
          if (!match) {
             for (const [dbName, p] of puestoMap.entries()) {
               if (dbName.includes(cleanPuestoValue) || cleanPuestoValue.includes(dbName)) {
                 match = p;
                 break;
               }
             }
          }
          
          let votosASumar = 1;
          if (votosColIdx !== null && votosColIdx !== undefined && row[votosColIdx] !== undefined) {
            const rawVotos = String(row[votosColIdx]);
            const numVotos = parseInt(rawVotos.replace(/[^0-9]/g, ''), 10);
            if (!isNaN(numVotos)) {
              votosASumar = numVotos;
            }
          }

          if (match) {
            totalMatched++;
            fileMatched++;
            conteoPorPuestoId[match.id] = (conteoPorPuestoId[match.id] || 0) + votosASumar;
            
            if (action === 'preview' && previewData.length < 50) {
              previewData.push({
                original: puestoValue,
                matched: match.nombre,
                votos: votosASumar,
                status: 'ok'
              });
            }
          } else {
            unmatched[cleanPuestoValue] = (unmatched[cleanPuestoValue] || 0) + 1;
            if (action === 'preview' && previewData.length < 50) {
               previewData.push({
                 original: puestoValue,
                 matched: 'No encontrado',
                 votos: votosASumar,
                 status: 'error'
               });
            }
          }
        }
        
        fileResults.push({ name: file.name, rows: fileRows, matched: fileMatched, unmatched: fileRows - fileMatched });
      } catch (e: any) {
        fileResults.push({ name: file.name, error: e.message || 'Error desconocido' });
      }
    }

    if (action === 'preview') {
      return NextResponse.json({
        success: true,
        totalRows,
        totalMatched,
        totalUnmatched: totalRows - totalMatched,
        fileResults,
        previewData,
        unmatchedPuestos: Object.entries(unmatched).sort((a, b) => b[1] - a[1]).slice(0, 50).map(([name, count]) => ({ name, count }))
      });
    }

    // Si la acción es 'commit', guardamos en DB
    let updatedCount = 0;
    for (const [puestoId, conteo] of Object.entries(conteoPorPuestoId)) {
      await prisma.puesto.update({
        where: { id: Number(puestoId) },
        data: { 
          estimadoVotos: {
            increment: conteo
          } 
        }
      });
      updatedCount++;
    }

    return NextResponse.json({
      success: true,
      totalRows,
      totalMatched,
      totalUnmatched: totalRows - totalMatched,
      updatedPuestos: updatedCount,
      fileResults,
      unmatchedPuestos: Object.entries(unmatched).sort((a, b) => b[1] - a[1]).slice(0, 50).map(([name, count]) => ({ name, count }))
    });

  } catch (error: any) {
    console.error('Error al importar estimados:', error);
    return NextResponse.json({ error: 'Error interno del servidor', details: error.message }, { status: 500 });
  }
}
