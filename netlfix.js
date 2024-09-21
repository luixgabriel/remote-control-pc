const puppeteer = require("puppeteer");

// Substitua por suas credenciais da Netflix
const email = "neymarr001@hotmail.com";
const password = "ufcd2023";

const netflixUrl = "https://www.netflix.com";

// Função de espera personalizada para versões antigas do Puppeteer
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--start-maximized"],
    defaultViewport: null,
  });

  const page = await browser.newPage();
  await page.goto(netflixUrl, { waitUntil: 'networkidle2' });

  // Clica no botão de "Entrar" na página principal
  await page.waitForSelector('a[data-uia="header-login-link"]');
  await page.click('a[data-uia="header-login-link"]');

  // Faz login na Netflix após a página de login carregar
  await page.waitForSelector('input[name="userLoginId"]');

  // Preenche o campo de email ou telefone
  await page.type('input[name="userLoginId"]', email, { delay: 100 });

  // Preenche o campo de senha
  await page.type('input[name="password"]', password, { delay: 100 });

  // Clica no botão de login
  await page.click('button[type="submit"]'); // Botão de login

  // Espera a página carregar após login
  await page.waitForNavigation({ waitUntil: 'networkidle2' });

  await page.waitForSelector(".list-profiles");

  // Obtém todos os perfis disponíveis na página
  const profiles = await page.evaluate(() => {
    // Seleciona todos os elementos com a classe 'profile-link'
    const profileElements = document.querySelectorAll(".profile-link");
    const profileData = [];

    // Itera sobre os perfis para capturar o nome e o link de cada um
    profileElements.forEach((profile) => {
      const nameElement = profile.querySelector(".profile-name");
      const name = nameElement ? nameElement.innerText.trim() : 'Nome Desconhecido';
      const link = profile.href;
      profileData.push({ name, link });
    });

    return profileData;
  });

  // Exibe os perfis coletados
  console.log("Perfis encontrados:");
  profiles.forEach((profile, index) => {
    console.log(`${index + 1}. Nome: ${profile.name}, Link: ${profile.link}`);
  });

  // Verifica se o perfil desejado existe
  const desiredProfileIndex = profiles.findIndex(profile => profile.name.toLowerCase() === 'luix');
  if (desiredProfileIndex === -1) {
    console.log("Perfil 'luix' não encontrado.");
    await browser.close();
    return;
  }

  // Navega para o link do perfil "luix"
  await page.goto(profiles[desiredProfileIndex].link, { waitUntil: 'networkidle2' });

  // Aguarda a página principal carregar
  await page.waitForSelector(".lolomoRow_title_card[data-list-context='continueWatching']");

  // Extrai os vídeos da seção "Continuar assistindo"
  const continueWatchingVideos = await page.evaluate(() => {
    const videoList = [];
    // Seleciona a seção "Continuar assistindo" usando o atributo data-list-context
    const continueWatchingSection = document.querySelector(".lolomoRow_title_card[data-list-context='continueWatching']");
    if (continueWatchingSection) {
      // Seleciona todos os elementos de vídeo dentro da seção
      const videoElements = continueWatchingSection.querySelectorAll(".slider-refocus");
      videoElements.forEach((video) => {
        const title = video.getAttribute('aria-label') || video.querySelector('.fallback-text')?.innerText || 'Título Desconhecido';
        const link = video.href;
        videoList.push({ title, link });
      });
    }
    return videoList;
  });

  // Exibe os vídeos encontrados na seção "Continuar assistindo"
  console.log("Vídeos na seção 'Continuar assistindo':");
  continueWatchingVideos.forEach((video, index) => {
    console.log(`${index + 1}. Título: ${video.title}, Link: ${video.link}`);
  });

  // Verifica se há pelo menos um vídeo na seção
  if (continueWatchingVideos.length > 0) {
    // Clica no primeiro vídeo da seção "Continuar assistindo"
    console.log(`Reproduzindo o primeiro vídeo: ${continueWatchingVideos[0].title}`);
    await page.goto(continueWatchingVideos[0].link, { waitUntil: 'networkidle2' });

    // Opcional: Aguarda alguns segundos para garantir que o vídeo comece a reproduzir
    await wait(5000); // Substituído por uma função de espera compatível
  } else {
    console.log("Nenhum vídeo encontrado na seção 'Continuar assistindo'.");
  }

  // O navegador permanece aberto para visualizar o vídeo
  // Para fechar o navegador após a execução, descomente a linha abaixo:
  // await browser.close();
}

main();
