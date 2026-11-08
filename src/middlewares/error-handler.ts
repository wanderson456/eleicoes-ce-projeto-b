import type { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (
  error,
  _request,
  response,
  next
) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  response.status(500).json({
    error: "Erro interno do servidor",
    message: "Ocorreu uma falha inesperada ao processar a solicitação."
  });
};