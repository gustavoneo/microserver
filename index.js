import express from "express";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const GERENCIA_TOKEN = process.env.GERENCIA_CLIENTES_TOKEN;
const RELAY_SECRET = process.env.RELAY_SECRET;

// Endpoint de saúde para o Railway testar
app.get("/health", (req, res) => {
  res.json({ status: "ok", tokenConfigured: Boolean(GERENCIA_TOKEN) });
});

// Repassa qualquer rota de app-store para a API oficial do Gerencia Clientes
app.all("/api/app-store/*", async (req, res) => {
  // 1. Proteção: se você definiu uma chave secreta, exige que o UpLIST a envie
  if (RELAY_SECRET) {
    const providedSecret = req.headers["x-relay-secret"];
    if (providedSecret !== RELAY_SECRET) {
      return res.status(401).json({ success: false, error: "Acesso ao relay não autorizado." });
    }
  }

  // 2. Token: usa o token configurado no Railway (ou o repassado no cabeçalho)
  const token = GERENCIA_TOKEN || req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return res.status(401).json({ success: false, error: "Nenhum token do Gerencia Clientes configurado." });
  }

  // 3. Monta a URL de destino oficial
  const path = req.params[0] + (req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "");
  const targetUrl = `https://painel.gerenciaclientes.com.br/api/app-store/${path}`;

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method: req.method,
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
      },
      body: req.method !== "GET" && req.method !== "HEAD" ? JSON.stringify(req.body) : undefined,
    });

    const data = await upstreamResponse.text();
    res.status(upstreamResponse.status);
    res.set("Content-Type", upstreamResponse.headers.get("content-type") || "application/json");
    res.send(data);
  } catch (err) {
    res.status(502).json({
      success: false,
      error: `Falha na ponte com o Gerencia Clientes: ${err.message}`
    });
  }
});

app.listen(PORT, () => {
  console.log(`Relay rodando na porta ${PORT}`);
});
