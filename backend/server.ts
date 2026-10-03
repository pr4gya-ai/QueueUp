import "dotenv/config";
import express, { Request, Response, NextFunction} from 'express';
import cors from "cors";
import connectDB from "./config/db.js";

const app = express();

// database connection
await connectDB();

// Middleware
app.use(cors())
app.use(express.json());

const port = process.env.PORT || 3000;

app.get('/', (_req: Request, res: Response) => {
  res.send('Server is Live!');
});

// Global error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  const message =
    err?.response?.data?.message || err?.message || "Something went wrong";
  res.status(err?.response?.status || err?.status || 500).send(message);
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});