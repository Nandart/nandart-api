// File: /api/submissoes.js

import { Octokit } from '@octokit/rest';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

const REPO_OWNER = 'Nandart';
const REPO_NAME = 'nandart-submissoes';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    const { data: issues } = await octokit.rest.issues.listForRepo({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      state: 'open',
      labels: ['obra']
    });

    const pendentes = [];

    for (const issue of issues) {
      try {
        const dados = JSON.parse(issue.body);

        if (
          dados.titulo &&
          dados.nomeArtista &&
          dados.descricao &&
          dados.estilo &&
          dados.tecnica &&
          dados.ano &&
          dados.dimensoes &&
          dados.materiais &&
          dados.local &&
          dados.enderecowallet &&
          dados.imagem
        ) {
          pendentes.push({
            id: issue.number,
            titulo: dados.titulo,
            nomeArtista: dados.nomeArtista,
            imagem: dados.imagem,
            url: issue.html_url
          });
        } else {
          console.warn(`[AVISO] Issue #${issue.number} com dados incompletos.`);
        }
      } catch (e) {
        console.warn(`[AVISO] Issue #${issue.number} com corpo inválido.`);
      }
    }

    return res.status(200).json({
      total: pendentes.length,
      pendentes
    });
  } catch (erro) {
    console.error('[ERRO] Ao obter submissões:', erro);
    return res.status(500).json({ message: 'Erro ao obter submissões' });
  }
}
