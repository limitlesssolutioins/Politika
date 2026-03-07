import * as XLSX from 'xlsx';

const files = [
  'C:\\Users\\USUARIO\\Downloads\\Archivos con Puestos de votacion\\Bogota\\Base PAHOLA HERRERA.xlsx',
  'C:\\Users\\USUARIO\\Downloads\\Archivos con Puestos de votacion\\Bogota\\EQIPO FAIDY.xlsx',
  'C:\\Users\\USUARIO\\Downloads\\Archivos con Puestos de votacion\\Bogota\\VOTANTES joemir.xlsx',
  'C:\\Users\\USUARIO\\Downloads\\Archivos con Puestos de votacion\\Bogota\\Base JR 29 - FINAL.xlsx'
];

for (const file of files) {
  try {
    const workbook = XLSX.readFile(file);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Read the first 15 rows
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false }) as any[][];
    if (data.length > 0) {
      console.log(`\n=== Rows for ${file} ===`);
      for (let i = 0; i < Math.min(15, data.length); i++) {
         console.log(`Row ${i}:`, data[i]);
      }
    } else {
      console.log(`\nNo data found in ${file}`);
    }
  } catch (error) {
    console.error(`\nError reading ${file}:`, error);
  }
}
