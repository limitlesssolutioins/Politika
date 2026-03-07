/**
 * Script de importación masiva del CSV electoral a SQLite.
 * Usa better-sqlite3 directamente para máximo rendimiento con transacciones batch.
 *
 * Uso: npx ts-node --esm scripts/import-csv.ts [--limit N]
 */
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import Papa from "papaparse";

const CSV_PATH = process.env.CSV_PATH || path.resolve(__dirname, "../../MMV_2023_NACIONAL.csv");
const DB_PATH = path.resolve(__dirname, "../prisma/dev.db");
const BATCH_SIZE = 50_000;

// Parse --limit flag
const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg !== -1 ? parseInt(process.argv[limitArg + 1], 10) : Infinity;

interface CSVRow {
  "Código Departamento": string;
  "Nombre Departamento": string;
  "Código Municipio": string;
  "Nombre Municipio": string;
  "Código Zona": string;
  "Código Puesto": string;
  "Nombre Puesto": string;
  "Mesa": string;
  "Código Comuna": string;
  "Nombre Comuna": string;
  "Código Corporación": string;
  "Nombre Corporación": string;
  "Código Circunscripción": string;
  "Código Partido": string;
  "Nombre Partido": string;
  "Código Candidato": string;
  "Nombre Candidato": string;
  "Total Votos": string;
}

// In-memory caches for normalized entity IDs
const deptCache = new Map<string, number>();
const muniCache = new Map<string, number>();
const zonaCache = new Map<string, number>();
const puestoCache = new Map<string, number>();
const mesaCache = new Map<string, number>();
const comunaCache = new Map<string, number>();
const corpCache = new Map<string, number>();
const partidoCache = new Map<string, number>();
const candidatoCache = new Map<string, number>();

function main() {
  console.log("=== Importación de datos electorales ===");
  console.log(`CSV: ${CSV_PATH}`);
  console.log(`DB:  ${DB_PATH}`);
  if (LIMIT !== Infinity) console.log(`Límite: ${LIMIT} registros`);
  console.log();

  if (!fs.existsSync(CSV_PATH)) {
    console.error(`ERROR: No se encontró el archivo CSV en ${CSV_PATH}`);
    process.exit(1);
  }

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = OFF");
  db.pragma("cache_size = -64000"); // 64MB cache
  db.pragma("temp_store = MEMORY");

  // Prepared statements for inserts
  const stmts = {
    insertDept: db.prepare("INSERT OR IGNORE INTO Departamento (codigo, nombre) VALUES (?, ?)"),
    getDeptId: db.prepare("SELECT id FROM Departamento WHERE codigo = ?"),

    insertMuni: db.prepare("INSERT OR IGNORE INTO Municipio (codigo, nombre, departamentoId) VALUES (?, ?, ?)"),
    getMuniId: db.prepare("SELECT id FROM Municipio WHERE codigo = ? AND departamentoId = ?"),

    insertZona: db.prepare("INSERT OR IGNORE INTO Zona (codigo, municipioId) VALUES (?, ?)"),
    getZonaId: db.prepare("SELECT id FROM Zona WHERE codigo = ? AND municipioId = ?"),

    insertPuesto: db.prepare("INSERT OR IGNORE INTO Puesto (codigo, nombre, zonaId) VALUES (?, ?, ?)"),
    getPuestoId: db.prepare("SELECT id FROM Puesto WHERE codigo = ? AND zonaId = ?"),

    insertMesa: db.prepare("INSERT OR IGNORE INTO Mesa (numero, puestoId) VALUES (?, ?)"),
    getMesaId: db.prepare("SELECT id FROM Mesa WHERE numero = ? AND puestoId = ?"),

    insertComuna: db.prepare("INSERT OR IGNORE INTO Comuna (codigo, nombre, municipioId) VALUES (?, ?, ?)"),

    insertCorp: db.prepare("INSERT OR IGNORE INTO Corporacion (codigo, nombre) VALUES (?, ?)"),
    getCorpId: db.prepare("SELECT id FROM Corporacion WHERE codigo = ?"),

    insertPartido: db.prepare("INSERT OR IGNORE INTO Partido (codigo, nombre) VALUES (?, ?)"),
    getPartidoId: db.prepare("SELECT id FROM Partido WHERE codigo = ?"),

    insertCandidato: db.prepare("INSERT OR IGNORE INTO Candidato (codigo, nombre, partidoId) VALUES (?, ?, ?)"),
    getCandidatoId: db.prepare("SELECT id FROM Candidato WHERE codigo = ? AND partidoId = ?"),

    insertVoto: db.prepare(
      "INSERT INTO Voto (mesaId, corporacionId, circunscripcion, partidoId, candidatoId, totalVotos) VALUES (?, ?, ?, ?, ?, ?)"
    ),
  };

  function getOrCreateDept(codigo: string, nombre: string): number {
    let id = deptCache.get(codigo);
    if (id !== undefined) return id;
    stmts.insertDept.run(codigo, nombre);
    id = (stmts.getDeptId.get(codigo) as { id: number }).id;
    deptCache.set(codigo, id);
    return id;
  }

  function getOrCreateMuni(codigo: string, nombre: string, deptId: number): number {
    const key = `${codigo}_${deptId}`;
    let id = muniCache.get(key);
    if (id !== undefined) return id;
    stmts.insertMuni.run(codigo, nombre, deptId);
    id = (stmts.getMuniId.get(codigo, deptId) as { id: number }).id;
    muniCache.set(key, id);
    return id;
  }

  function getOrCreateZona(codigo: string, muniId: number): number {
    const key = `${codigo}_${muniId}`;
    let id = zonaCache.get(key);
    if (id !== undefined) return id;
    stmts.insertZona.run(codigo, muniId);
    id = (stmts.getZonaId.get(codigo, muniId) as { id: number }).id;
    zonaCache.set(key, id);
    return id;
  }

  function getOrCreatePuesto(codigo: string, nombre: string, zonaId: number): number {
    const key = `${codigo}_${zonaId}`;
    let id = puestoCache.get(key);
    if (id !== undefined) return id;
    stmts.insertPuesto.run(codigo, nombre, zonaId);
    id = (stmts.getPuestoId.get(codigo, zonaId) as { id: number }).id;
    puestoCache.set(key, id);
    return id;
  }

  function getOrCreateMesa(numero: number, puestoId: number): number {
    const key = `${numero}_${puestoId}`;
    let id = mesaCache.get(key);
    if (id !== undefined) return id;
    stmts.insertMesa.run(numero, puestoId);
    id = (stmts.getMesaId.get(numero, puestoId) as { id: number }).id;
    mesaCache.set(key, id);
    return id;
  }

  function getOrCreateCorp(codigo: string, nombre: string): number {
    let id = corpCache.get(codigo);
    if (id !== undefined) return id;
    stmts.insertCorp.run(codigo, nombre);
    id = (stmts.getCorpId.get(codigo) as { id: number }).id;
    corpCache.set(codigo, id);
    return id;
  }

  function getOrCreatePartido(codigo: string, nombre: string): number {
    let id = partidoCache.get(codigo);
    if (id !== undefined) return id;
    stmts.insertPartido.run(codigo, nombre);
    id = (stmts.getPartidoId.get(codigo) as { id: number }).id;
    partidoCache.set(codigo, id);
    return id;
  }

  function getOrCreateCandidato(codigo: string, nombre: string, partidoId: number): number {
    const key = `${codigo}_${partidoId}`;
    let id = candidatoCache.get(key);
    if (id !== undefined) return id;
    stmts.insertCandidato.run(codigo, nombre, partidoId);
    id = (stmts.getCandidatoId.get(codigo, partidoId) as { id: number }).id;
    candidatoCache.set(key, id);
    return id;
  }

  // Batch processing
  let rowCount = 0;
  let batchRows: CSVRow[] = [];
  const startTime = Date.now();

  function processBatch(rows: CSVRow[]) {
    const transaction = db.transaction(() => {
      for (const row of rows) {
        const deptId = getOrCreateDept(row["Código Departamento"], row["Nombre Departamento"]);
        const muniId = getOrCreateMuni(row["Código Municipio"], row["Nombre Municipio"], deptId);
        const zonaId = getOrCreateZona(row["Código Zona"], muniId);
        const puestoId = getOrCreatePuesto(row["Código Puesto"], row["Nombre Puesto"], zonaId);
        const mesaNum = parseInt(row["Mesa"], 10);
        const mesaId = getOrCreateMesa(mesaNum, puestoId);

        // Comuna (solo insertar, no necesitamos el ID para votos)
        if (row["Código Comuna"] && row["Nombre Comuna"]) {
          stmts.insertComuna.run(row["Código Comuna"], row["Nombre Comuna"], muniId);
        }

        const corpId = getOrCreateCorp(row["Código Corporación"], row["Nombre Corporación"]);
        const partidoId = getOrCreatePartido(row["Código Partido"], row["Nombre Partido"]);
        const candidatoId = getOrCreateCandidato(row["Código Candidato"], row["Nombre Candidato"], partidoId);

        const totalVotos = parseInt(row["Total Votos"], 10) || 0;
        stmts.insertVoto.run(mesaId, corpId, row["Código Circunscripción"], partidoId, candidatoId, totalVotos);
      }
    });
    transaction();
  }

  function buildResumenes() {
    console.log("\nGenerando resúmenes pre-calculados...");

    db.exec(`
      DELETE FROM ResumenDepartamento;
      INSERT INTO ResumenDepartamento (departamentoId, corporacionId, partidoId, totalVotos)
      SELECT
        d.id as departamentoId,
        v.corporacionId,
        v.partidoId,
        SUM(v.totalVotos) as totalVotos
      FROM Voto v
      JOIN Mesa m ON v.mesaId = m.id
      JOIN Puesto p ON m.puestoId = p.id
      JOIN Zona z ON p.zonaId = z.id
      JOIN Municipio mu ON z.municipioId = mu.id
      JOIN Departamento d ON mu.departamentoId = d.id
      GROUP BY d.id, v.corporacionId, v.partidoId;
    `);
    console.log("  ResumenDepartamento completado.");

    db.exec(`
      DELETE FROM ResumenMunicipio;
      INSERT INTO ResumenMunicipio (municipioId, corporacionId, partidoId, totalVotos)
      SELECT
        mu.id as municipioId,
        v.corporacionId,
        v.partidoId,
        SUM(v.totalVotos) as totalVotos
      FROM Voto v
      JOIN Mesa m ON v.mesaId = m.id
      JOIN Puesto p ON m.puestoId = p.id
      JOIN Zona z ON p.zonaId = z.id
      JOIN Municipio mu ON z.municipioId = mu.id
      GROUP BY mu.id, v.corporacionId, v.partidoId;
    `);
    console.log("  ResumenMunicipio completado.");
  }

  // Parse CSV using streaming
  console.log("Iniciando lectura del CSV...\n");

  const fileStream = fs.createReadStream(CSV_PATH, { encoding: "utf-8" });

  Papa.parse<CSVRow>(fileStream, {
    header: true,
    skipEmptyLines: true,
    step: (result) => {
      if (rowCount >= LIMIT) return;

      batchRows.push(result.data);
      rowCount++;

      if (batchRows.length >= BATCH_SIZE) {
        processBatch(batchRows);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const rate = Math.round(rowCount / ((Date.now() - startTime) / 1000));
        process.stdout.write(
          `\r  Procesados: ${rowCount.toLocaleString()} registros | ${elapsed}s | ${rate.toLocaleString()} reg/s`
        );
        batchRows = [];
      }
    },
    complete: () => {
      // Process remaining rows
      if (batchRows.length > 0) {
        processBatch(batchRows);
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`\n\nImportación completada:`);
      console.log(`  Total registros: ${rowCount.toLocaleString()}`);
      console.log(`  Tiempo: ${elapsed}s`);
      console.log(`  Departamentos: ${deptCache.size}`);
      console.log(`  Municipios: ${muniCache.size}`);
      console.log(`  Puestos: ${puestoCache.size}`);
      console.log(`  Mesas: ${mesaCache.size}`);
      console.log(`  Corporaciones: ${corpCache.size}`);
      console.log(`  Partidos: ${partidoCache.size}`);
      console.log(`  Candidatos: ${candidatoCache.size}`);

      // Build pre-computed summaries
      buildResumenes();

      console.log("\n=== Importación finalizada exitosamente ===");
      db.close();
    },
    error: (error: Error) => {
      console.error("Error parseando CSV:", error.message);
      db.close();
      process.exit(1);
    },
  });
}

main();
