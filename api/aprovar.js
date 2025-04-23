// File: /api/aprovar.js

import { Octokit } from '@octokit/rest';
import slugify from 'slugify';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

const REPO_OWNER = 'Nandart';
const REPO_NAME = 'nandart-submissoes';
const REPO_PUBLIC = 'nandart-galeria';
const BRANCH_DESTINO = 'main'; // ou outro nome se necessário

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
    return res.status(400).json({ message: 'Dados em falta na submissão' });
  }

  try {
    const slug = slugify(`${nomeArtista}-${titulo}`, { lower: true, strict: true });
    const filePath = `galeria/obras/${slug}.md`;

    const conteudo = `
---
titulo: "${titulo}"
artista: "${nomeArtista}"
imagem: "${imagem}"
slug: "${slug}"
---
    `.trim();

    const contentEncoded = Buffer.from(conteudo).toString('base64');

    // Obter SHA do último commit do main
    const { data: refData } = await octokit.rest.git.getRef({
      owner: REPO_OWNER,
      repo: REPO_PUBLIC,
      ref: `heads/${BRANCH_DESTINO}`
    });

    const shaBase = refData.object.sha;
    const branchName = `aprovacao-${id}-${Date.now()}`;

    // Criar novo branch
    await octokit.rest.git.createRef({
      owner: REPO_OWNER,
      repo: REPO_PUBLIC,
      ref: `refs/heads/${branchName}`,
      sha: shaBase
    });

    // Criar ficheiro com a obra
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_PUBLIC,
      path: filePath,
      message: `Adicionar nova obra: ${titulo}`,
      content: contentEncoded,
      branch: branchName
    });

    // Criar PR
    await octokit.rest.pulls.create({
      owner: REPO_OWNER,
      repo: REPO_PUBLIC,
      title: `Aprovar nova obra: ${titulo}`,
      head: branchName,
      base: BRANCH_DESTINO,
      body: `Esta obra foi aprovada no painel e está pronta para ser integrada na galeria.`
    });

    // Atualizar issue como aprovada
    await octokit.rest.issues.update({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      issue_number: id,
      labels: ['aprovada', 'obra']
    });

    return res.status(200).json({ message: 'Pull Request criado com sucesso!' });
  } catch (erro) {
    console.error('[ERRO] Ao criar Pull Request:', erro);
    return res.status(500).json({ message: 'Erro ao criar Pull Request. Verifique o log.' });
  }
}
