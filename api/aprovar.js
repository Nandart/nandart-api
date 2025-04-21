// File: /api/aprovar.js

import { Octokit } from '@octokit/rest';
import slugify from 'slugify';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const REPO_OWNER = 'Nandart';
const REPO_NAME = 'nandart-submissoes';
const BASE_BRANCH = 'main';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    const {
      nomeArtista,
      titulo,
      descricao,
      estilo,
      tecnica,
      ano,
      dimensoes,
      materiais,
      local,
      enderecowallet,
      imageUrl
    } = req.body;

    if (!nomeArtista || !titulo || !descricao || !imageUrl) {
      return res.status(400).json({ message: 'Campos obrigatórios em falta' });
    }

    const slug = slugify(titulo, { lower: true, strict: true });
    const fileName = `galeria/obras/${slug}.json`;

    const conteudoObra = {
      titulo,
      artista: nomeArtista,
      descricao,
      estilo,
      tecnica,
      ano,
      dimensoes,
      materiais,
      local,
      imagem: imageUrl,
      carteira: enderecowallet,
      dataSubmissao: new Date().toISOString()
    };

    const jsonContent = JSON.stringify(conteudoObra, null, 2);

    // 1. Obter o SHA da main
    const baseRef = await octokit.rest.git.getRef({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      ref: `heads/${BASE_BRANCH}`,
    });

    const baseSha = baseRef.data.object.sha;
    const branchName = `adicionar-obra-${slug}`;

    // 2. Criar nova branch
    await octokit.rest.git.createRef({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      ref: `refs/heads/${branchName}`,
      sha: baseSha,
    });

    // 3. Adicionar ficheiro JSON à nova branch
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: fileName,
      message: `Adicionar obra: ${titulo}`,
      content: Buffer.from(jsonContent).toString('base64'),
      branch: branchName,
    });

    // 4. Criar Pull Request
    const pr = await octokit.rest.pulls.create({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      title: `✨ Novo PR: Obra "${titulo}"`,
      head: branchName,
      base: BASE_BRANCH,
      body: `Obra submetida por ${nomeArtista}. Aguardando aprovação para ser adicionada à galeria.`,
    });

    return res.status(200).json({
      message: 'Pull Request criado com sucesso!',
      prUrl: pr.data.html_url,
    });

  } catch (erro) {
    console.error('[ERRO] Ao criar PR automático:', erro);
    return res.status(500).json({ message: 'Erro ao criar Pull Request automático' });
  }
}
