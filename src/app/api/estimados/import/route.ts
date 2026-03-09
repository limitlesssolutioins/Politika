import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PDFParse } from 'pdf-parse';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

function normalizeStr(str: unknown): string {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' ');
}

// Para Excel/CSV: la IA detecta qué columna es cada campo (depto, muni, puesto, votos)
async function detectExcelColumns(data: any[][]): Promise<{
  headerRowIdx: number;
  deptoColIdx: number | null;
  muniColIdx: number | null;
  puestoColIdx: number | null;
  votosColIdx: number | null;
}> {
  const fallback = { headerRowIdx: 0, deptoColIdx: null, muniColIdx: null, puestoColIdx: null, votosColIdx: null };
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const sample = data.slice(0, 15);
    const prompt = `
Analiza estas filas de datos electorales colombianos e identifica el índice de columna (empezando en 0) para cada campo:
- "deptoColIdx": columna de Departamento/Depto/Departamento (null si no existe)
- "muniColIdx": columna de Municipio/Ciudad/Localidad (null si no existe)
- "puestoColIdx": columna de Puesto de Votación/Lugar/Colegio/Sede/Institución (OBLIGATORIO, null si no existe)
- "votosColIdx": columna numérica de Votos Estimados/Meta/Total (null si es listado nominal de personas)
- "headerRowIdx": índice de la fila que contiene los encabezados

Si el archivo es un listado nominal de personas/votantes (una persona por fila sin columna de total), "votosColIdx" debe ser null.
Devuelve SOLO JSON válido, sin texto adicional.
Ejemplo: {"headerRowIdx": 0, "deptoColIdx": 0, "muniColIdx": 1, "puestoColIdx": 2, "votosColIdx": 3}
Datos: ${JSON.stringify(sample)}
    `;
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    return fallback;
  } catch (e) {
    console.error('Error AI detectExcelColumns:', e);
    return fallback;
  }
}

// Para PDF/imagen: la IA extrae Y normaliza directamente al formato estándar
async function extractNormalizedFromFile(file: File): Promise<any[][] | null> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let pdfText = '';
    if (file.type === 'application/pdf') {
      try {
        const parser = new PDFParse({ data: new Uint8Array(bytes) });
        const r = await parser.getText();
        pdfText = r.text;
        await parser.destroy();
      } catch {}
    }

    const prompt = `
Eres un analista de datos electorales colombianos. Extrae la información de este documento.

FORMATO DE SALIDA OBLIGATORIO — devuelve un JSON array de arrays con exactamente estas columnas:
["DEPARTAMENTO", "MUNICIPIO", "PUESTO", "ESTIMADO"]

REGLAS DE EXTRACCIÓN:
1. Si el documento menciona un departamento y/o municipio de forma general (en el título o cabecera), repítelo en TODAS las filas.
2. Si es un listado nominal (una persona por fila), incluye una fila por persona con ESTIMADO = 1.
3. Si es un resumen por puesto, incluye una fila por puesto con el total en ESTIMADO.
4. Si no hay información de departamento o municipio, deja esa celda como cadena vacía "".
5. PUESTO es el nombre del colegio, institución o lugar de votación.

EJEMPLO DE SALIDA:
[["DEPARTAMENTO","MUNICIPIO","PUESTO","ESTIMADO"],["CUNDINAMARCA","BOGOTÁ D.C.","COLEGIO SAN JOSÉ","150"],["CUNDINAMARCA","BOGOTÁ D.C.","INSTITUTO TÉCNICO","80"]]

Devuelve ÚNICAMENTE el JSON array. Sin markdown, sin explicaciones, sin texto adicional.
${pdfText ? `\nContenido del documento:\n${pdfText}` : ''}
    `;

    let result;
    if (pdfText && pdfText.length > 100) {
      result = await model.generateContent(prompt);
    } else {
      result = await model.generateContent([
        prompt,
        { inlineData: { data: buffer.toString('base64'), mimeType: file.type } },
      ]);
    }

    const text = result.response.text().trim();
    const arrMatch = text.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      const parsed = JSON.parse(arrMatch[0]);
      if (Array.isArray(parsed) && Array.isArray(parsed[0])) return parsed;
    }
    return null;
  } catch (e) {
    console.error('Error AI extractNormalizedFromFile:', e);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];
    const action = (formData.get('action') as string) || 'commit';

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No se enviaron archivos' }, { status: 400 });
    }

    // Construir mapas de cruce con clave triple, doble y simple
    const allPuestos = await prisma.puesto.findMany({
      include: { zona: { include: { municipio: { include: { departamento: true } } } } },
    });

    const tripleMap = new Map<string, number>(); // DEPTO|MUNI|PUESTO → id
    const doubleMap = new Map<string, number>(); // MUNI|PUESTO → id
    const singleMap = new Map<string, number>(); // PUESTO → id (primer match)
    const idToName  = new Map<number, string>();

    for (const p of allPuestos) {
      const depto  = normalizeStr(p.zona.municipio.departamento.nombre);
      const muni   = normalizeStr(p.zona.municipio.nombre);
      const nombre = normalizeStr(p.nombre);
      tripleMap.set(`${depto}|${muni}|${nombre}`, p.id);
      if (!doubleMap.has(`${muni}|${nombre}`)) doubleMap.set(`${muni}|${nombre}`, p.id);
      if (!singleMap.has(nombre)) singleMap.set(nombre, p.id);
      idToName.set(p.id, p.nombre);
    }

    const conteoPorPuestoId: Record<number, number> = {};
    const unmatched: Record<string, number> = {};
    let totalRows = 0;
    let totalMatched = 0;
    const fileResults: any[] = [];
    const previewData: any[] = [];

    for (const file of files) {
      try {
        let data: any[][] | null = null;
        const ext = file.name.split('.').pop()?.toLowerCase();
        let isNormalizedFormat = false; // true = columnas ya en orden [DEPTO, MUNI, PUESTO, ESTIMADO]

        if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
          const bytes = await file.arrayBuffer();
          const workbook = XLSX.read(Buffer.from(bytes), { type: 'buffer' });
          data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {
            header: 1, blankrows: false,
          }) as any[][];
        } else if (file.type.startsWith('image/') || ext === 'pdf') {
          data = await extractNormalizedFromFile(file);
          isNormalizedFormat = true;
        } else {
          fileResults.push({ name: file.name, error: 'Formato no soportado.' });
          continue;
        }

        if (!data || data.length === 0) {
          fileResults.push({ name: file.name, error: 'No se pudo extraer datos del archivo.' });
          continue;
        }

        // Determinar índices de columnas
        let idxDepto: number | null  = null;
        let idxMuni: number | null   = null;
        let idxPuesto: number | null = null;
        let idxVotos: number | null  = null;
        let startRow = 1;

        if (isNormalizedFormat) {
          // La IA ya devolvió [DEPARTAMENTO, MUNICIPIO, PUESTO, ESTIMADO]
          const headers = data[0].map((h: unknown) => normalizeStr(String(h || '')));
          idxDepto  = headers.indexOf('DEPARTAMENTO');  if (idxDepto  === -1) idxDepto  = null;
          idxMuni   = headers.indexOf('MUNICIPIO');     if (idxMuni   === -1) idxMuni   = null;
          idxPuesto = headers.indexOf('PUESTO');        if (idxPuesto === -1) idxPuesto = null;
          idxVotos  = headers.indexOf('ESTIMADO');      if (idxVotos  === -1) idxVotos  = null;
          startRow  = 1;
        } else {
          // Excel/CSV: la IA detecta posiciones
          const cols = await detectExcelColumns(data);
          idxDepto  = cols.deptoColIdx;
          idxMuni   = cols.muniColIdx;
          idxPuesto = cols.puestoColIdx;
          idxVotos  = cols.votosColIdx;
          startRow  = cols.headerRowIdx >= 0 ? cols.headerRowIdx + 1 : 1;
        }

        if (idxPuesto === null) {
          fileResults.push({ name: file.name, error: 'No se identificó la columna de Puesto de Votación.' });
          continue;
        }

        let fileRows = 0;
        let fileMatched = 0;

        for (let i = startRow; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length === 0) continue;

          const rawPuesto = String(row[idxPuesto] || '').trim();
          if (!rawPuesto) continue;

          // Normalizar y limpiar número de mesa si viene incluido
          const puestoNorm = normalizeStr(rawPuesto)
            .replace(/ MESA \d+/g, '')
            .replace(/ MSA \d+/g, '')
            .trim();
          const deptoNorm = idxDepto !== null ? normalizeStr(String(row[idxDepto] || '')) : '';
          const muniNorm  = idxMuni  !== null ? normalizeStr(String(row[idxMuni]  || '')) : '';

          totalRows++;
          fileRows++;

          // Cascada de matching: triple → doble → simple → fuzzy
          let puestoId: number | undefined;
          let matchLevel = '';

          if (deptoNorm && muniNorm) {
            puestoId = tripleMap.get(`${deptoNorm}|${muniNorm}|${puestoNorm}`);
            if (puestoId) matchLevel = 'Depto+Muni+Puesto';
          }
          if (!puestoId && muniNorm) {
            puestoId = doubleMap.get(`${muniNorm}|${puestoNorm}`);
            if (puestoId) matchLevel = 'Muni+Puesto';
          }
          if (!puestoId) {
            puestoId = singleMap.get(puestoNorm);
            if (puestoId) matchLevel = 'Solo Nombre';
          }
          if (!puestoId) {
            for (const [key, id] of singleMap.entries()) {
              if (key.includes(puestoNorm) || puestoNorm.includes(key)) {
                puestoId = id;
                matchLevel = 'Aproximado';
                break;
              }
            }
          }

          const votos =
            idxVotos !== null && row[idxVotos] !== undefined
              ? parseInt(String(row[idxVotos]).replace(/[^0-9]/g, ''), 10) || 1
              : 1;

          if (puestoId) {
            totalMatched++;
            fileMatched++;
            conteoPorPuestoId[puestoId] = (conteoPorPuestoId[puestoId] || 0) + votos;

            if (action === 'preview' && previewData.length < 50) {
              previewData.push({
                original: [deptoNorm || '?', muniNorm || '?', rawPuesto].filter(Boolean).join(' / '),
                matched: idToName.get(puestoId) || '',
                matchLevel,
                votos,
                status: 'ok',
              });
            }
          } else {
            const key = [deptoNorm, muniNorm, puestoNorm].filter(Boolean).join('|');
            unmatched[key] = (unmatched[key] || 0) + 1;
            if (action === 'preview' && previewData.length < 50) {
              previewData.push({
                original: [deptoNorm || '?', muniNorm || '?', rawPuesto].filter(Boolean).join(' / '),
                matched: 'No encontrado',
                matchLevel: '-',
                votos,
                status: 'error',
              });
            }
          }
        }

        fileResults.push({
          name: file.name,
          rows: fileRows,
          matched: fileMatched,
          unmatched: fileRows - fileMatched,
        });
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
        unmatchedPuestos: Object.entries(unmatched)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 50)
          .map(([name, count]) => ({ name, count })),
      });
    }

    // Commit — asignación directa (no increment) para evitar NULL + N = NULL
    let updatedCount = 0;
    const entries = Object.entries(conteoPorPuestoId);
    const BATCH = 500;
    for (let i = 0; i < entries.length; i += BATCH) {
      const slice = entries.slice(i, i + BATCH);
      await prisma.$transaction(
        slice.map(([puestoId, votos]) =>
          prisma.puesto.update({
            where: { id: Number(puestoId) },
            data: { estimadoVotos: votos },
          })
        )
      );
      updatedCount += slice.length;
    }

    return NextResponse.json({
      success: true,
      totalRows,
      totalMatched,
      totalUnmatched: totalRows - totalMatched,
      updatedPuestos: updatedCount,
      fileResults,
      unmatchedPuestos: Object.entries(unmatched)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 50)
        .map(([name, count]) => ({ name, count })),
    });
  } catch (error: any) {
    console.error('Error importando estimados:', error);
    return NextResponse.json({ error: 'Error interno', details: error.message }, { status: 500 });
  }
}
