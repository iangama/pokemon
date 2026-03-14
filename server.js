const http = require("http");
const fs = require("fs");
const path = require("path");

const port = process.env.PORT || 4173;
const root = __dirname;

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
};

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host}`);
  const requestPath = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const safePath = path.normalize(requestPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = path.join(root, safePath.replace(/^[/\\]+/, ""));

  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(error.code === "ENOENT" ? 404 : 500);
      res.end(error.code === "ENOENT" ? "Not found" : "Internal server error");
      return;
    }

    const ext = path.extname(filePath);
    res.writeHead(200, {
      "Content-Type": contentTypes[ext] || "application/octet-stream",
    });
    res.end(data);
  });
});

server.listen(port, () => {
  console.log(`Pokemon API app running at http://localhost:${port}`);
});
