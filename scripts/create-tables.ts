/**
 * Creates SQLite tables directly using better-sqlite3.
 * Run: npx ts-node --compiler-options '{"module":"commonjs"}' scripts/create-tables.ts
 */
import path from "path";
import Database from "better-sqlite3";

const DB_PATH = path.resolve(__dirname, "../prisma/dev.db");
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS "Departamento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "Departamento_codigo_key" ON "Departamento"("codigo");

  CREATE TABLE IF NOT EXISTS "Municipio" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "departamentoId" INTEGER NOT NULL,
    CONSTRAINT "Municipio_departamentoId_fkey" FOREIGN KEY ("departamentoId") REFERENCES "Departamento" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "Municipio_codigo_departamentoId_key" ON "Municipio"("codigo", "departamentoId");

  CREATE TABLE IF NOT EXISTS "Zona" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "codigo" TEXT NOT NULL,
    "municipioId" INTEGER NOT NULL,
    CONSTRAINT "Zona_municipioId_fkey" FOREIGN KEY ("municipioId") REFERENCES "Municipio" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "Zona_codigo_municipioId_key" ON "Zona"("codigo", "municipioId");

  CREATE TABLE IF NOT EXISTS "Puesto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "zonaId" INTEGER NOT NULL,
    CONSTRAINT "Puesto_zonaId_fkey" FOREIGN KEY ("zonaId") REFERENCES "Zona" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "Puesto_codigo_zonaId_key" ON "Puesto"("codigo", "zonaId");

  CREATE TABLE IF NOT EXISTS "Mesa" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "numero" INTEGER NOT NULL,
    "puestoId" INTEGER NOT NULL,
    "potencialElectoral" INTEGER,
    CONSTRAINT "Mesa_puestoId_fkey" FOREIGN KEY ("puestoId") REFERENCES "Puesto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "Mesa_numero_puestoId_key" ON "Mesa"("numero", "puestoId");

  CREATE TABLE IF NOT EXISTS "Comuna" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "municipioId" INTEGER NOT NULL,
    CONSTRAINT "Comuna_municipioId_fkey" FOREIGN KEY ("municipioId") REFERENCES "Municipio" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "Comuna_codigo_municipioId_key" ON "Comuna"("codigo", "municipioId");

  CREATE TABLE IF NOT EXISTS "Corporacion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "Corporacion_codigo_key" ON "Corporacion"("codigo");

  CREATE TABLE IF NOT EXISTS "Partido" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "Partido_codigo_key" ON "Partido"("codigo");

  CREATE TABLE IF NOT EXISTS "Candidato" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "partidoId" INTEGER NOT NULL,
    CONSTRAINT "Candidato_partidoId_fkey" FOREIGN KEY ("partidoId") REFERENCES "Partido" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "Candidato_codigo_partidoId_key" ON "Candidato"("codigo", "partidoId");

  CREATE TABLE IF NOT EXISTS "Voto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "mesaId" INTEGER NOT NULL,
    "corporacionId" INTEGER NOT NULL,
    "circunscripcion" TEXT NOT NULL,
    "partidoId" INTEGER NOT NULL,
    "candidatoId" INTEGER NOT NULL,
    "totalVotos" INTEGER NOT NULL,
    CONSTRAINT "Voto_mesaId_fkey" FOREIGN KEY ("mesaId") REFERENCES "Mesa" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Voto_corporacionId_fkey" FOREIGN KEY ("corporacionId") REFERENCES "Corporacion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Voto_partidoId_fkey" FOREIGN KEY ("partidoId") REFERENCES "Partido" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Voto_candidatoId_fkey" FOREIGN KEY ("candidatoId") REFERENCES "Candidato" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  );
  CREATE INDEX IF NOT EXISTS "Voto_corporacionId_partidoId_idx" ON "Voto"("corporacionId", "partidoId");
  CREATE INDEX IF NOT EXISTS "Voto_mesaId_idx" ON "Voto"("mesaId");
  CREATE INDEX IF NOT EXISTS "Voto_candidatoId_idx" ON "Voto"("candidatoId");
  CREATE INDEX IF NOT EXISTS "Voto_partidoId_idx" ON "Voto"("partidoId");
  CREATE INDEX IF NOT EXISTS "Voto_corporacionId_idx" ON "Voto"("corporacionId");

  CREATE TABLE IF NOT EXISTS "ResumenDepartamento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "departamentoId" INTEGER NOT NULL,
    "corporacionId" INTEGER NOT NULL,
    "partidoId" INTEGER NOT NULL,
    "totalVotos" INTEGER NOT NULL,
    CONSTRAINT "ResumenDepartamento_departamentoId_fkey" FOREIGN KEY ("departamentoId") REFERENCES "Departamento" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ResumenDepartamento_corporacionId_fkey" FOREIGN KEY ("corporacionId") REFERENCES "Corporacion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ResumenDepartamento_partidoId_fkey" FOREIGN KEY ("partidoId") REFERENCES "Partido" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "ResumenDepartamento_departamentoId_corporacionId_partidoId_key" ON "ResumenDepartamento"("departamentoId", "corporacionId", "partidoId");
  CREATE INDEX IF NOT EXISTS "ResumenDepartamento_departamentoId_idx" ON "ResumenDepartamento"("departamentoId");
  CREATE INDEX IF NOT EXISTS "ResumenDepartamento_corporacionId_idx" ON "ResumenDepartamento"("corporacionId");
  CREATE INDEX IF NOT EXISTS "ResumenDepartamento_partidoId_idx" ON "ResumenDepartamento"("partidoId");

  CREATE TABLE IF NOT EXISTS "ResumenMunicipio" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "municipioId" INTEGER NOT NULL,
    "corporacionId" INTEGER NOT NULL,
    "partidoId" INTEGER NOT NULL,
    "totalVotos" INTEGER NOT NULL,
    CONSTRAINT "ResumenMunicipio_municipioId_fkey" FOREIGN KEY ("municipioId") REFERENCES "Municipio" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ResumenMunicipio_corporacionId_fkey" FOREIGN KEY ("corporacionId") REFERENCES "Corporacion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ResumenMunicipio_partidoId_fkey" FOREIGN KEY ("partidoId") REFERENCES "Partido" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "ResumenMunicipio_municipioId_corporacionId_partidoId_key" ON "ResumenMunicipio"("municipioId", "corporacionId", "partidoId");
  CREATE INDEX IF NOT EXISTS "ResumenMunicipio_municipioId_idx" ON "ResumenMunicipio"("municipioId");
  CREATE INDEX IF NOT EXISTS "ResumenMunicipio_corporacionId_idx" ON "ResumenMunicipio"("corporacionId");
  CREATE INDEX IF NOT EXISTS "ResumenMunicipio_partidoId_idx" ON "ResumenMunicipio"("partidoId");

  CREATE TABLE IF NOT EXISTS "ObjetivoCampana" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nivel" TEXT NOT NULL,
    "nivelId" INTEGER NOT NULL,
    "partidoId" INTEGER NOT NULL,
    "corporacionId" INTEGER NOT NULL,
    "metaVotos" INTEGER NOT NULL,
    CONSTRAINT "ObjetivoCampana_partidoId_fkey" FOREIGN KEY ("partidoId") REFERENCES "Partido" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ObjetivoCampana_corporacionId_fkey" FOREIGN KEY ("corporacionId") REFERENCES "Corporacion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "ObjetivoCampana_nivel_nivelId_partidoId_corporacionId_key" ON "ObjetivoCampana"("nivel", "nivelId", "partidoId", "corporacionId");
  CREATE INDEX IF NOT EXISTS "ObjetivoCampana_partidoId_idx" ON "ObjetivoCampana"("partidoId");
  CREATE INDEX IF NOT EXISTS "ObjetivoCampana_corporacionId_idx" ON "ObjetivoCampana"("corporacionId");
`);

console.log("Tablas creadas exitosamente.");

// Verify
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log("Tablas:", tables.map((t: unknown) => (t as { name: string }).name).join(", "));

db.close();
