// File: /api/submissoes.js

import { Octokit } from "@octokit/rest";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const REPO_OWNER = "Nandart";
const REPO_NAME = "nandart-submissoes";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ message: "Método não permitido" });
  }

  try {
    const { data: issues } = await octokit.rest.issues.listForRepo({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      state: "open",
      labels: "submissão,pendente de revisão",
    });

    const pendentes = issues.map((issue) => ({
      id: issue.number,
      titulo: issue.title,
      url: issue.html_url,
      criadoEm: issue.created_at,
    }));

    return res.status(200).json({
      total: pendentes.length,
      pendentes,
    });
  } catch (error) {
    console.error("[ERRO] A obter submissões pendentes:", error);
    return res
      .status(500)
      .json({ message: "Erro ao obter submissões pendentes." });
  }
}
