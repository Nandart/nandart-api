// File: /api/aprovar.js

import { Octokit } from '@octokit/rest';
import slugify from 'slugify';

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
    return res.status(400).json({ message: 'Dados em falta na submissão' });
  }

  try {
    const slug = slugify(`${nomeArtista}-${titulo}`, { lower: true });
    const path = `galeria/obras/${slug}.json`;

    const conteudo = {
      titulo,
      artista: nomeArtista,
      imagem,
      slug
    };

    const fileContentEncoded = Buffer.from(JSON.stringify(conteudo, null, 2)).toString('base64');

    const { data: repo } = await octokit.rest.repos.get({ owner: REPO_OWNER, repo: REPO_PUBLIC });
    const baseSha = (await octokit.rest.git.getRef({
      owner: REPO_OWNER,
      repo: REPO_PUBLIC,
      ref: `heads/${BRANCH}`
    })).data.object.sha;

    const branchName = `aprovacao-${id}-${Date.now()}`;

    await octokit.rest.git.createRef({
      owner: REPO_OWNER,
      repo: REPO_PUBLIC,
      ref: `refs/heads/${branchName}`,
      sha: baseSha
    });

    await octokit.rest.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_PUBLIC,
      path,
      message: `Adicionar obra: ${titulo}`,
      content: fileContentEncoded,
      branch: branchName
    });

    await octokit.rest.pulls.create({
      owner: REPO_OWNER,
      repo: REPO_PUBLIC,
      title: `Aprovar obra: ${titulo}`,
      head: branchName,
      base: BRANCH,
      body: `Esta obra foi aprovada e está pronta para a galeria.`
    });

    await octokit.rest.issues.update({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      issue_number: id,
      labels: ['aprovada']
    });

    return res.status(200).json({ message: 'Pull Request criado com sucesso!' });
  } catch (erro) {
    console.error('[ERRO] Ao criar PR automático:', erro);
    return res.status(500).json({ message: 'Erro ao criar Pull Request' });
  }
}
