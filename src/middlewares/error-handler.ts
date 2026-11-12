
import type { ErrorRequestHandler } from "express";
import { logger } from "../config/logger.js";

export const errorHandler: ErrorRequestHandler = (
  error,
  request,
  response,
  next
) => {
  
  logger.error(
    {
      err: error,
      method: request.method,
      url: request.originalUrl
    },
    "Erro não tratado durante o processamento da requisição."
  );

  if (response.headersSent) {
    next(error);
    return;
  }

 
  response.status(500).json({
    error: "Erro interno do servidor",
    message: "Ocorreu uma falha inesperada ao processar a solicitação."
  });
};
