require("dotenv").config();
const puppeteer = require("puppeteer");

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

    console.log(profiles);

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

runPuppeteer();
