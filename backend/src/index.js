import "dotenv/config";

const { default: app } = await import("./app.js");

const port = Number(process.env.PORT) || 4000;

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Veyra API running on http://localhost:${port}`);
  });
}

export default app;
