const puppeteer = require('puppeteer');
const prompt = require('prompt');
const cheerio = require("cheerio");
const fs = require("fs").promises;
const fsNormal = require("fs");
const axios = require('axios');

prompt.start();

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function escapeHtml(unsafe)
{
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


async function main() {
    const browser = await puppeteer.launch({headless: false});
    const page = await browser.newPage();
    try {
        const cookiesString = await fs.readFile('./cookies.json');
        const oldCookies = JSON.parse(cookiesString);
        await page.setCookie(...oldCookies);
    } catch (err) {
    }
    await page.goto('https://instytutkryptografii.pl/auth/login', {
        waitUntil: 'networkidle2',
    });
    console.log('Type yes or no:');
    const {signed_in} = await prompt.get(['signed_in']);
    if (signed_in !== 'yes') return 0;
    const cookies = await page.cookies();
    await fs.writeFile('./cookies.json', JSON.stringify(cookies, null, 2));

    await page.goto('https://instytutkryptografii.pl/product/lessons/1009#lesson');
    const html = await page.evaluate(() => {
        let table = document.querySelector('tbody');
        return table.innerHTML;
    });

    const data = [];
    // const html = await fs.readFile('table.html')
    const $ = cheerio.load(html);
    // fs.writeFile('table.html', html);
    $('a').each((i, elem) => {
        data.push({
            link: 'https://instytutkryptografii.pl/' + $(elem).attr('href'),
            name: $(elem).text().replace('\n', '')
        });
    });

    for (const row of data) {
        console.log(`Downloading: ${row.name}`);
        const videoPage = await browser.newPage();
        try {
            const cookiesString = await fs.readFile('./cookies.json');
            const oldCookies = JSON.parse(cookiesString);
            await videoPage.setCookie(...oldCookies);
        } catch (err) {
        }

        videoPage.on('response', response => {
            if (response.url().includes('.mp4')) {
                const headers = response.request().headers();
                const url = response.request().url();
                delete headers['range'];
                axios({
                    method: "get",
                    url,
                    responseType: 'stream',
                    headers
                }).then(function (response) {
                    response.data.pipe(fsNormal.createWriteStream(`${escapeHtml(row.name)}.mp4`));
                }).catch(console.log);
            }
            return response;
        });
        try {
            await videoPage.goto(row.link);
            await videoPage.click('.mejs__overlay-button');
        } catch (err) {
        }
        await sleep(20000);
        await videoPage.close();
    }


}

main();
