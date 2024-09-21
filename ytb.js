const puppeteer = require("puppeteer");

const searchQuery = "Cenário transparente"; // Insira o nome do vídeo aqui
const youtubeUrl = "https://www.youtube.com";

async function main() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--start-maximized'],
    defaultViewport: null,
  });

  const page = await browser.newPage();
  await page.goto(youtubeUrl);

  // Espera o campo de pesquisa do YouTube aparecer e insere o termo de pesquisa
  await page.waitForSelector('input#search');
  await page.type('input#search', searchQuery);

  // Pressiona "Enter" para pesquisar
  await page.keyboard.press('Enter');

  // Espera os resultados da pesquisa aparecerem
  await page.waitForSelector('ytd-video-renderer', { timeout: 10000 });

  // Coleta os links dos vídeos da pesquisa
  const videos = await page.evaluate(() => {
    const videoElements = Array.from(document.querySelectorAll('ytd-video-renderer'));

    const videoData = videoElements.map(video => ({
      title: video.querySelector('#video-title')?.textContent.trim(),
      url: video.querySelector('#video-title')?.href,
      channel: video.querySelector('#channel-name')?.textContent.trim()
    }));

    return videoData;
  });

  if (videos.length > 0) {
    const firstVideoUrl = videos[0].url;

    // Navega até o primeiro vídeo
    await page.goto(firstVideoUrl);

    // Espera o botão de tela cheia aparecer
    await page.waitForSelector('.ytp-fullscreen-button');

    // Clica no botão de tela cheia
    await page.click('.ytp-fullscreen-button');

    console.log(`Assistindo ao vídeo: ${videos[0].title}`);
  } else {
    console.log('Nenhum vídeo encontrado.');
  }

  // O navegador permanece aberto para assistir ao vídeo
  // await browser.close();
}

main();
