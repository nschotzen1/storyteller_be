export function registerDocsRoutes(app, deps) {
  const {
    OPEN_API_SPEC
  } = deps;

  app.get('/api/openapi.json', (req, res) => {
    return res.status(200).json(OPEN_API_SPEC);
  });

  app.get('/api/docs', (req, res) => {
    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Storyteller API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      html, body { margin: 0; padding: 0; background: #f3f5f8; }
      #swagger-ui { max-width: 1200px; margin: 0 auto; }
      .topbar { background: #ffffff; border-bottom: 1px solid #d9e0ea; }
      .swagger-ui .scheme-container { background: #ffffff; box-shadow: none; border-bottom: 1px solid #e4e8ef; }
      .swagger-ui .opblock.opblock-post { border-color: #5c8ef3; background: rgba(92, 142, 243, 0.06); }
      .swagger-ui .opblock.opblock-get { border-color: #35a56a; background: rgba(53, 165, 106, 0.06); }
      .swagger-ui .opblock.opblock-put,
      .swagger-ui .opblock.opblock-patch { border-color: #d39a2f; background: rgba(211, 154, 47, 0.06); }
      .swagger-ui .opblock.opblock-delete { border-color: #d9534f; background: rgba(217, 83, 79, 0.06); }
      .swagger-ui .opblock-tag { border-bottom: 1px solid #e4e8ef; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: '/api/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis],
        layout: 'BaseLayout'
      });
    </script>
  </body>
</html>`;
    return res.status(200).type('html').send(html);
  });
}
