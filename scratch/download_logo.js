const fs = require('fs');
const https = require('https');
const path = require('path');
const { URL } = require('url');

const urlString = "https://scontent.fcmb1-2.fna.fbcdn.net/v/t39.30808-6/559679736_1297316365426545_2707586598231779437_n.jpg?_nc_cat=108&ccb=1-7&_nc_sid=6ee11a&_nc_eui2=AeHX9cZOr1V7JEZPwDnuTrfvjKH7CjQ_FIaMofsKND8UhvO3JOtOY4WdWeBzhhzFe8oM8fw8BiKTaiWY8PhFqyyh&_nc_ohc=oBQT4vuOE5QQ7kNvwERvS3g&_nc_oc=AdpKwgEjaU41wrQntmYXRuQwvEjBVQwXvHm-aLQT1jC9XP5pfcS37n6UMxtth7POgSd1cV9_CdGBrTg50Hiu02gF&_nc_zt=23&_nc_ht=scontent.fcmb1-2.fna&_nc_gid=FYCdKEk-o-gKCDRols8Q1g&_nc_ss=7b2a8&oh=00_Af06X1-9_MuSMO_w_LiZHsYSODGslXDN51odUtbitAgvLA&oe=6A1C4D7A";
const targetPath = path.join(__dirname, '..', 'public', 'images', 'logo.png');

console.log('Downloading logo with User-Agent...');
console.log('Saving to:', targetPath);

const parsedUrl = new URL(urlString);

const options = {
  hostname: parsedUrl.hostname,
  path: parsedUrl.pathname + parsedUrl.search,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }
};

https.get(options, (response) => {
  if (response.statusCode !== 200) {
    console.error(`Failed to get logo: ${response.statusCode}`);
    return;
  }
  
  const fileStream = fs.createWriteStream(targetPath);
  response.pipe(fileStream);
  
  fileStream.on('finish', () => {
    fileStream.close();
    console.log('Logo downloaded successfully!');
  });
}).on('error', (err) => {
  console.error('Error downloading logo:', err.message);
});
