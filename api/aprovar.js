// File: /api/aprovar.js

import { Octokit } from '@octokit/rest';
import slugify from 'slugify';

export const config = {
  api: {
    bodyParser: true
  }
};

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

const REPO_OWNER = 'Nandart';
const REPO_NAME = 'nandart-submissoes';
const REPO_PUBLIC = 'nandart-galeria';
const BRANCH = process.env.REPO_PUBLIC_BRANCH || 'main';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const { id, titulo, nomeArtista, imagem } = req.body;

  if (!id || !titulo || !nomeArtista || !imagem) {
    return res.status(400).json({ message: 'Dados obrigatórios em falta.' });
  }

  try {
    const slug = slugify(`${nomeArtista}-${titulo}`, { lower: true, strict: true });
    const path = `galeria/obras/${slug}.md`;

    const conteudo = `
---
titulo: "${titulo}"
artista: "${nomeArtista}"
imagem: "${imagem}"
slug: "${slug}"
---
`.trim();

    const contentEncoded = Buffer.from(conteudo).toString('base64');

    // Obter o SHA da branch base
    const ref = await octokit.rest.git.getRef({
      owner: REPO_OWNER,
      repo: REPO_PUBLIC,
      ref: `heads/${BRANCH}`
    });

    const baseSha = ref.data.object.sha;
    const branchName = `aprovacao-${id}-${Date.now()}`;

    // Criar nova branch a partir da branch base
    await octokit.rest.git.createRef({
      owner: REPO_OWNER,
      repo: REPO_PUBLIC,
      ref: `refs/heads/${branchName}`,
      sha: baseSha
    });

    // Criar ficheiro da obra na nova branch
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_PUBLIC,
      path,
      message: `Adicionar obra aprovada: ${titulo}`,
      content: contentEncoded,
      branch: branchName
    });

    // Criar Pull Request
    await octokit.rest.pulls.create({
      owner: REPO_OWNER,
      repo: REPO_PUBLIC,
      title: `Aprovação de nova obra: ${titulo}`,
      head: branchName,
      base: BRANCH,
      body: `Esta obra foi aprovada e está pronta para integrar a galeria pública.`
    });

    // Atualizar a issue original
    await octokit.rest.issues.update({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      issue_number: id,
      labels: ['obra', 'aprovada']
    });

    return res.status(200).json({ message: 'Pull Request criado com sucesso!' });
  } catch (erro) {
    console.error('[ERRO] Ao criar Pull Request:', erro);
    return res.status(500).json({ message: 'Erro ao criar Pull Request.' });
  }
}
