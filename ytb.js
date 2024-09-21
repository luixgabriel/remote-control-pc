const puppeteer = require("puppeteer");

const youtubeUrl = "https://www.youtube.com";

async function main() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--start-maximized"],
    defaultViewport: null,
  });

  const page = await browser.newPage();
  await page.goto(youtubeUrl);

  // Espera os vídeos carregarem
  await page.waitForSelector("ytd-rich-item-renderer", { timeout: 10000 });

  // Coleta os links dos vídeos visíveis
  const videos = await page.evaluate(() => {
    const videoElements = Array.from(
      document.querySelectorAll("ytd-rich-item-renderer")
    );

    const videoData = videoElements.map((video) => ({
      title: video.querySelector("#video-title")?.textContent.trim(),
      url: video.querySelector("#video-title")?.href,
      channel: video.querySelector("#channel-name")?.textContent.trim(),
    }));

    return videoData;
  });

  if (videos.length > 0) {
    console.log("Vídeos encontrados:");
    videos.forEach((video) => {
      console.log(
        `Título: ${video.title}\nURL: ${video.url}\nCanal: ${video.channel}\n`
      );
    });
  } else {
    console.log("Nenhum vídeo encontrado.");
  }

  // O navegador permanece aberto
  // await browser.close();
}

main();
