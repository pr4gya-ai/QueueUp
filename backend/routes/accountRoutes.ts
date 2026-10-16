import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { addAccounts, disconnectAccount, getAccounts } from "../controllers/accountControllers.js";

const accountRouter = express.Router();

accountRouter.get('/', protect, getAccounts);
accountRouter.post('/', protect, addAccounts);
accountRouter.delete('/:id', protect, disconnectAccount);

export default accountRouter;