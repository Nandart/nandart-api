// File: /api/submit.js

import { Octokit } from '@octokit/rest';
import { IncomingForm } from 'formidable';
import { v2 as cloudinary } from 'cloudinary';
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

const REPO_OWNER = process.env.REPO_OWNER;
const REPO_NAME = process.env.REPO_NAME;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const form = new IncomingForm({ uploadDir: '/tmp', keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Erro ao processar o formulário:', err);
      return res.status(500).json({ message: 'Erro ao processar o formulário' });
    }

    const {
      nomeArtista, titulo, descricao, estilo,
      tecnica, ano, dimensoes, materiais,
      local, wallet
    } = fields;

    const imagem = files.imagem;

    if (!nomeArtista || !titulo || !descricao || !estilo || !tecnica ||
        !ano || !dimensoes || !materiais || !local || !wallet || !imagem) {
      return res.status(400).json({ message: 'Todos os campos obrigatórios devem ser preenchidos' });
    }

    try {
      const uploadResult = await cloudinary.uploader.upload(imagem.filepath, {
        folder: 'nandart'
      });

      const imageUrl = uploadResult.secure_url;

      const corpo = `
**Título**: ${titulo}
**Artista**: ${nomeArtista}
**Ano**: ${ano}
**Estilo**: ${estilo}
**Técnica**: ${tecnica}
**Dimensões**: ${dimensoes}
**Materiais**: ${materiais}
**Local**: ${local}
**Descrição**: ${descricao}

**Carteira**: ${wallet}
**Imagem**:  
![Obra](${imageUrl})
      `.trim();

      const issue = await octokit.rest.issues.create({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        title: `Nova Submissão: "${titulo}" por ${nomeArtista}`,
        body: corpo,
        labels: ['obra', 'pendente']
      });

      return res.status(200).json({
        message: 'Submissão registada com sucesso!',
        issueUrl: issue.data.html_url,
        imagemUrl: imageUrl
      });

    } catch (erro) {
      console.error('[ERRO] Upload ou criação de issue:', erro);
      return res.status(500).json({ message: 'Erro interno ao processar a submissão' });
    }
  });
}
