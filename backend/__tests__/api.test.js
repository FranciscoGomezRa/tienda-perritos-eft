// Tests unitarios de la API (etapa "test" del pipeline CI/CD).
// La base de datos se MOCKEA: no se necesita MySQL para correrlos,
// por eso pueden ejecutarse en GitHub Actions sin infraestructura.
const request = require("supertest");

// Mock del driver ANTES de importar la app: createPool devuelve un pool falso
const mockQuery = jest.fn();
jest.mock("mysql2/promise", () => ({
  createPool: jest.fn(() => ({ query: mockQuery })),
}));

const { app, initDb } = require("../app");

beforeAll(async () => {
  await initDb(); // inicializa el pool (mockeado)
});

beforeEach(() => {
  mockQuery.mockReset();
});

describe("GET /api/health", () => {
  test("responde 200 con status ok (probe de Kubernetes)", async () => {
    const res = await request(app).get("/api/health");
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});

describe("GET /api/productos", () => {
  test("devuelve la lista de productos", async () => {
    const productos = [
      { id: 1, nombre: "Croquetas Premium", descripcion: "Para adultos", precio: 15990, stock: 20 },
    ];
    mockQuery.mockResolvedValueOnce([productos]);

    const res = await request(app).get("/api/productos");
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(productos);
  });

  test("responde 500 si la BD falla", async () => {
    mockQuery.mockRejectedValueOnce(new Error("BD caída"));
    const res = await request(app).get("/api/productos");
    expect(res.statusCode).toBe(500);
  });
});

describe("GET /api/productos/:id", () => {
  test("responde 404 si el producto no existe", async () => {
    mockQuery.mockResolvedValueOnce([[]]);
    const res = await request(app).get("/api/productos/999");
    expect(res.statusCode).toBe(404);
  });
});

describe("POST /api/productos", () => {
  test("responde 400 si faltan campos obligatorios", async () => {
    const res = await request(app).post("/api/productos").send({ descripcion: "sin nombre ni precio" });
    expect(res.statusCode).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test("crea un producto válido y responde 201", async () => {
    const nuevo = { id: 7, nombre: "Pelota", descripcion: null, precio: 2990, stock: 50 };
    mockQuery
      .mockResolvedValueOnce([{ insertId: 7 }]) // INSERT
      .mockResolvedValueOnce([[nuevo]]); // SELECT del creado

    const res = await request(app)
      .post("/api/productos")
      .send({ nombre: "Pelota", precio: 2990, stock: 50 });
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual(nuevo);
  });
});

describe("DELETE /api/productos/:id", () => {
  test("responde 404 si no hay filas afectadas", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }]);
    const res = await request(app).delete("/api/productos/123");
    expect(res.statusCode).toBe(404);
  });
});
