import * as XLSX from 'xlsx';
import { prisma } from '../src/lib/prisma';

const files = [
  'C:\\Users\\USUARIO\\Downloads\\Archivos con Puestos de votacion\\Bogota\\Base PAHOLA HERRERA.xlsx',
  'C:\\Users\\USUARIO\\Downloads\\Archivos con Puestos de votacion\\Bogota\\EQIPO FAIDY.xlsx',
  'C:\\Users\\USUARIO\\Downloads\\Archivos con Puestos de votacion\\Bogota\\VOTANTES joemir.xlsx',
  'C:\\Users\\USUARIO\\Downloads\\Archivos con Puestos de votacion\\Bogota\\Base JR 29 - FINAL.xlsx'
];

function normalizeString(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' '); // Replace multiple spaces with a single space
}

async function main() {
  console.log('Cargando Puestos de la base de datos...');
  const puestos = await prisma.puesto.findMany();
  
  // Create a map for quick lookup
  const puestoMap = new Map<string, typeof puestos[0]>();
  puestos.forEach(p => {
    puestoMap.set(normalizeString(p.nombre), p);
  });
  
  const conteoPorPuestoId: Record<number, number> = {};
  const unmatched: Record<string, number> = {};
  let totalRows = 0;
  let totalMatched = 0;

  for (const file of files) {
    console.log(`\nProcesando archivo: ${file}`);
    try {
      const workbook = XLSX.readFile(file);
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false }) as any[][];
      
      if (data.length === 0) {
        console.log('  Archivo vacío.');
        continue;
      }
      
      // Find header row and column index for Puesto
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
        console.log('  [Advertencia] No se encontró la columna de Puesto de Votación en los primeros 10 registros.');
        continue;
      }
      
      // Process rows after header
      for (let i = headerRowIdx + 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;
        
        const puestoValue = String(row[puestoColIdx] || '');
        if (!puestoValue || puestoValue.trim() === '') continue;
        
        // Sometimes the Puesto column in these specific files contains text like "Colegio la prosperidad mesa 9"
        // Let's strip "mesa X" if present
        let cleanPuestoValue = normalizeString(puestoValue);
        cleanPuestoValue = cleanPuestoValue.replace(/ MESA \d+/g, '').replace(/ MSA \d+/g, '').trim();
        
        totalRows++;
        
        let match = puestoMap.get(cleanPuestoValue);
        
        // Simple fuzzy match if exact match fails (e.g. "COLEGIO ALIANZA" vs "COLEGIO QUIROGA ALIANZA")
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
          conteoPorPuestoId[match.id] = (conteoPorPuestoId[match.id] || 0) + 1;
        } else {
          unmatched[cleanPuestoValue] = (unmatched[cleanPuestoValue] || 0) + 1;
        }
      }
      
    } catch (error) {
      console.error(`  Error procesando archivo ${file}:`, error);
    }
  }
  
  console.log('\n=== Resumen de Extracción ===');
  console.log(`Total registros leídos: ${totalRows}`);
  console.log(`Total registros que cruzaron con BD: ${totalMatched}`);
  console.log(`Total registros sin cruzar: ${totalRows - totalMatched}`);
  
  if (Object.keys(unmatched).length > 0) {
    console.log('\n=== Puestos no encontrados en la BD (Top 20) ===');
    const sortedUnmatched = Object.entries(unmatched).sort((a, b) => b[1] - a[1]);
    for (let i = 0; i < Math.min(20, sortedUnmatched.length); i++) {
      console.log(`  ${sortedUnmatched[i][0]}: ${sortedUnmatched[i][1]} registros`);
    }
  }
  
  console.log('\nActualizando base de datos...');
  let updatedCount = 0;
  for (const [puestoId, conteo] of Object.entries(conteoPorPuestoId)) {
    await prisma.puesto.update({
      where: { id: Number(puestoId) },
      data: { estimadoVotos: conteo }
    });
    updatedCount++;
  }
  
  console.log(`¡Base de datos actualizada! Se actualizaron estimaciones en ${updatedCount} puestos de votación.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
