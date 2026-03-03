const { google } = require("googleapis");

const oauth2Client = new google.auth.OAuth2(
  "1023569597546-gbkh22dhpju03i5ogf6ut6p5bucuk6b0.apps.googleusercontent.com",
  "GOCSPX-Dte3z-Wku0PF-GUnLsZk7ioPuNm",
  "http://localhost"
);

const url = oauth2Client.generateAuthUrl({
  access_type: "offline",
  scope: ["https://www.googleapis.com/auth/adwords"],
});

console.log("Open this URL:");
console.log(url);
```