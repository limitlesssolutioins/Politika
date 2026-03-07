import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';

function normalizeString(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];

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

    for (const file of files) {
      try {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false }) as any[][];
        
        if (data.length === 0) {
          fileResults.push({ name: file.name, error: 'Archivo vacío.' });
          continue;
        }
        
        let headerRowIdx = -1;
        let puestoColIdx = -1;
        
        for (let i = 0; i < Math.min(10, data.length); i++) {
          const row = data[i];
          if (!row) continue;
          
          for (let j = 0; j < row.length; j++) {
            const cellStr = normalizeString(String(row[j] || ''));
            if (cellStr.includes('PUESTO DE VOTACION') || cellStr === 'LUGAR VOTACION') {
              headerRowIdx = i;
              puestoColIdx = j;
              break;
            }
          }
          if (headerRowIdx !== -1) break;
        }
        
        if (puestoColIdx === -1) {
          fileResults.push({ name: file.name, error: 'No se encontró la columna de Puesto de Votación en los primeros 10 registros.' });
          continue;
        }
        
        let fileRows = 0;
        let fileMatched = 0;

        for (let i = headerRowIdx + 1; i < data.length; i++) {
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
          
          if (match) {
            totalMatched++;
            fileMatched++;
            conteoPorPuestoId[match.id] = (conteoPorPuestoId[match.id] || 0) + 1;
          } else {
            unmatched[cleanPuestoValue] = (unmatched[cleanPuestoValue] || 0) + 1;
          }
        }
        
        fileResults.push({ name: file.name, rows: fileRows, matched: fileMatched, unmatched: fileRows - fileMatched });
      } catch (e: any) {
        fileResults.push({ name: file.name, error: e.message || 'Error desconocido' });
      }
    }

    let updatedCount = 0;
    // We do sequential updates to avoid locking issues in sqlite
    for (const [puestoId, conteo] of Object.entries(conteoPorPuestoId)) {
      // Find current to optionally add. The prompt said "sacar ir generando un aproximado de votos por puesto de votacion".
      // Adding it to existing or replacing? For an import, we can replace the value or increment. 
      // It's probably better to just set it to the count since we want "approximado de votos". Let's set it.
      await prisma.puesto.update({
        where: { id: Number(puestoId) },
        data: { estimadoVotos: conteo }
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
