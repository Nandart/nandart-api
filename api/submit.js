// File: /api/submit.js

import { Octokit } from '@octokit/rest';
import { v2 as cloudinary } from 'cloudinary';
import { createIncomingForm } from 'formidable';
import fs from 'fs';
import path from 'path';

export const config = {
  api: {
    bodyParser: false
  }
};

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

const REPO_OWNER = 'Nandart';
const REPO_NAME = 'nandart-submissoes';

function normalizarTexto(texto) {
  if (!texto || typeof texto !== 'string') return '';
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const form = createIncomingForm({ keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('[ERRO] Falha ao processar o formulário:', err);
      return res.status(500).json({ message: 'Erro ao processar o formulário' });
    }

    const {
      nome,
      titulo,
      descricao,
      estilo,
      tecnica,
      ano,
      dimensoes,
      materiais,
      local,
      carteira
    } = fields;

    if (
      !nome || !titulo || !descricao || !estilo || !tecnica ||
      !ano || !dimensoes || !materiais || !local || !carteira || !files.imagem
    ) {
      return res.status(400).json({ message: 'Todos os campos obrigatórios devem ser preenchidos' });
    }

    try {
      const imagem = files.imagem;
      const upload = await cloudinary.uploader.upload(imagem.filepath, {
        folder: 'nandart-obras',
        use_filename: true,
        unique_filename: false
      });

      const imagemUrl = upload.secure_url;

      const bodyIssue = `
**Título**: ${titulo}
**Artista**: ${nome}
**Ano**: ${ano}
**Estilo**: ${estilo}
**Técnica**: ${tecnica}
**Dimensões**: ${dimensoes}
**Materiais**: ${materiais}
**Local**: ${local}
**Descrição**: ${descricao}
**Carteira**: ${carteira}
**Imagem**: ![Obra](${imagemUrl})
      `.trim();

      const issue = await octokit.rest.issues.create({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        title: `Nova Submissão: "${titulo}" por ${nome}`,
        body: bodyIssue,
        labels: ['obra', 'pendente']
      });

      return res.status(200).json({ message: 'Submissão recebida com sucesso!' });
    } catch (erro) {
      console.error('[ERRO] Upload ou criação de issue:', erro);
      return res.status(500).json({ message: 'Erro ao fazer upload da imagem ou registar submissão' });
    }
  });
}
