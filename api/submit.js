// File: /api/submit.js

import formidable from 'formidable';
import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';
import { Octokit } from '@octokit/rest';

export const config = {
  api: {
    bodyParser: false,
  },
};

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const REPO_OWNER = 'Nandart';
const REPO_NAME = 'nandart-submissoes';

function normalizarTexto(texto) {
  return typeof texto === 'string'
    ? texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    : '';
}

function gerarMarkdown(dados, urlImagem) {
  return `
**Título:** ${dados.titulo}
**Artista:** ${dados.nomeArtista}
**Ano:** ${dados.ano}
**Estilo:** ${dados.estilo}
**Técnica:** ${dados.tecnica}
**Dimensões:** ${dados.dimensoes}
**Materiais:** ${dados.materiais}
**Local:** ${dados.local}
**Descrição:**  
${dados.descricao}

**Carteira:**  
${dados.wallet}

**Imagem:**  
![Obra](${urlImagem})
`.trim();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const form = new formidable.IncomingForm({ keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('[ERRO] ao processar formulário:', err);
      return res.status(500).json({ message: 'Erro ao processar o formulário' });
    }

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
      wallet,
    } = fields;

    const imagem = files.imagem;

    if (
      !nomeArtista ||
      !titulo ||
      !descricao ||
      !estilo ||
      !tecnica ||
      !ano ||
      !dimensoes ||
      !materiais ||
      !local ||
      !wallet ||
      !imagem
    ) {
      return res.status(400).json({ message: 'Todos os campos são obrigatórios' });
    }

    try {
      const uploadResult = await cloudinary.uploader.upload(imagem.filepath, {
        folder: 'nandart',
      });

      const urlImagem = uploadResult.secure_url;

      const body = gerarMarkdown(
        {
          nomeArtista: normalizarTexto(nomeArtista),
          titulo: normalizarTexto(titulo),
          descricao,
          estilo,
          tecnica,
          ano,
          dimensoes,
          materiais,
          local,
          wallet,
        },
        urlImagem
      );

      const issueTitle = `Nova Submissão: "${normalizarTexto(titulo)}" por ${normalizarTexto(nomeArtista)}`;

      await octokit.rest.issues.create({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        title: issueTitle,
        body,
        labels: ['submissão', 'pendente de revisão', 'obra'],
      });

      return res.status(200).json({ message: 'Submissão recebida com sucesso!' });
    } catch (erro) {
      console.error('[ERRO] Upload ou criação de issue:', erro);
      return res.status(500).json({ message: 'Erro ao fazer upload da imagem ou registar submissão' });
    }
  });
}
