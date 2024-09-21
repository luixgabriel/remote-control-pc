// index.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const puppeteer = require("puppeteer");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const rateLimit = require("express-rate-limit");
const Joi = require("joi");

const app = express();
const port = process.env.PORT || 3000;

// Cria o servidor HTTP
const server = http.createServer(app);

// Configura o Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*", // Ajuste conforme necessário para segurança
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// Rate Limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Limita a 100 solicitações por IP
  message:
    "Muitas solicitações a partir deste IP, por favor tente novamente depois de 15 minutos.",
});
app.use(limiter);

// Adiciona o plugin stealth

// Função de espera personalizada
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Esquema de validação com Joi
const schema = Joi.object({
  profileName: Joi.string().min(1).max(100).required(),
});

// Armazena as conexões dos PCs
const pcClients = new Map();

// Gerencia as conexões do Socket.IO
io.on("connection", (socket) => {
  console.log(`Cliente conectado: ${socket.id}`);

  // Evento para registrar o PC
  socket.on("register-pc", () => {
    pcClients.set(socket.id, socket);
    console.log(`PC registrado: ${socket.id}`);
  });

  // Evento de desconexão
  socket.on("disconnect", () => {
    pcClients.delete(socket.id);
    console.log(`Cliente desconectado: ${socket.id}`);
  });
});

// Rota para executar o script Puppeteer
app.post("/run-script", async (req, res) => {
  // Validação da chave de API
  // const apiKey = req.headers["x-api-key"];
  // if (apiKey !== process.env.API_KEY) {
  //   return res
  //     .status(403)
  //     .json({ error: "Acesso negado. Chave de API inválida." });
  // }

  // Validação da entrada
  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const { profileName } = value;

  try {
    // Chama a função Puppeteer
    const videos = await runPuppeteer(profileName);

    res.json({ success: true, data: videos });
  } catch (error) {
    console.error("Erro ao executar o Puppeteer:", error);
    res
      .status(500)
      .json({ success: false, error: "Erro interno do servidor." });
  }
});

// Rota para enviar link selecionado para o PC
app.post("/send-link", async (req, res) => {
  const { profileName, videoLink } = req.body;

  if (!profileName || !videoLink) {
    return res
      .status(400)
      .json({ error: "Nome do perfil ou link do vídeo não fornecido." });
  }

  // Encontra o PC conectado (neste exemplo, envia para todos os PCs)
  pcClients.forEach((socket) => {
    socket.emit("open-video", { profileName, videoLink });
  });

  res.json({ success: true, message: "Link enviado para o PC." });
});

// Função Puppeteer encapsulada
async function runPuppeteer(desiredProfileName) {
  const email = process.env.NETFLIX_EMAIL;
  const password = process.env.NETFLIX_PASSWORD;
  const netflixUrl = "https://www.netflix.com";

  if (!email || !password) {
    throw new Error(
      "Credenciais da Netflix não estão definidas nas variáveis de ambiente."
    );
  }

  const browser = await puppeteer.launch({
    headless: false, // true para produção, false para depuração
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--start-maximized",
      "--disable-infobars",
    ],
    defaultViewport: null,
  });

  try {
    const page = await browser.newPage();

    await page.goto(netflixUrl, { waitUntil: "networkidle2" });

    // Clica no botão de "Entrar" na página principal
    await page.waitForSelector('a[data-uia="header-login-link"]', {
      timeout: 10000,
    });
    await page.click('a[data-uia="header-login-link"]');

    // Faz login na Netflix após a página de login carregar
    await page.waitForSelector('input[name="userLoginId"]', { timeout: 10000 });

    // Preenche o campo de email ou telefone
    await page.type('input[name="userLoginId"]', email, { delay: 100 });

    // Preenche o campo de senha
    await page.type('input[name="password"]', password, { delay: 100 });

    // Clica no botão de login
    await page.click('button[type="submit"]'); // Botão de login

    // Espera a página carregar após login
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 });

    await page.waitForSelector(".list-profiles", { timeout: 10000 });

    // Obtém todos os perfis disponíveis na página
    const profiles = await page.evaluate(() => {
      const profileElements = document.querySelectorAll(".profile-link");
      const profileData = [];

      profileElements.forEach((profile) => {
        const nameElement = profile.querySelector(".profile-name");
        const name = nameElement
          ? nameElement.innerText.trim()
          : "Nome Desconhecido";
        const link = profile.href;
        profileData.push({ name, link });
      });

      return profileData;
    });

    if (profiles.length === 0) {
      throw new Error("Nenhum perfil encontrado.");
    }

    // Encontra o perfil desejado
    const desiredProfileIndex = profiles.findIndex(
      (profile) =>
        profile.name.toLowerCase() === desiredProfileName.toLowerCase()
    );
    if (desiredProfileIndex === -1) {
      throw new Error(`Perfil '${desiredProfileName}' não encontrado.`);
    }

    // Navega para o link do perfil desejado
    await page.goto(profiles[desiredProfileIndex].link, {
      waitUntil: "networkidle2",
    });

    // Aguarda a página principal carregar
    await page.waitForSelector(
      ".lolomoRow_title_card[data-list-context='continueWatching']",
      { timeout: 10000 }
    );

    // Extrai os vídeos da seção "Continuar Assistindo"
    const continueWatchingVideos = await page.evaluate(() => {
      const videoList = [];
      const continueWatchingSection = document.querySelector(
        ".lolomoRow_title_card[data-list-context='continueWatching']"
      );
      if (continueWatchingSection) {
        const videoElements =
          continueWatchingSection.querySelectorAll(".slider-refocus");
        videoElements.forEach((video) => {
          const title =
            video.getAttribute("aria-label") ||
            video.querySelector(".fallback-text")?.innerText ||
            "Título Desconhecido";
          const link = video.href;
          videoList.push({ title, link });
        });
      }
      return videoList;
    });

    // Retorna os dados encontrados
    return continueWatchingVideos;
  } catch (error) {
    console.error(error);
  } finally {
    await browser.close();
  }
}

// Inicia o servidor
server.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
