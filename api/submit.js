// File: /api/submit.js

import { IncomingForm } from 'formidable';
import { Octokit } from '@octokit/rest';
import fs from 'fs';
import cloudinary from 'cloudinary';

export const config = {
  api: {
    bodyParser: false
  }
};

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const REPO_OWNER = 'Nandart';
const REPO_NAME = 'nandart-submissoes';

function normalizarTexto(texto) {
  return texto
    ? texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s-]/g, '').trim()
    : '';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

  const form = new IncomingForm({ keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('[ERRO] Erro ao fazer parse do formulário:', err);
      return res.status(500).json({ message: 'Erro ao processar o formulário' });
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
        carteira
      } = fields;

      const imagemPath = files.imagem?.filepath || files.imagem?.path;

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
        !carteira ||
        !imagemPath
      ) {
        return res.status(400).json({ message: 'Todos os campos obrigatórios devem ser preenchidos' });
      }

      const upload = await cloudinary.v2.uploader.upload(imagemPath, {
        folder: 'nandart-obras',
        use_filename: true,
        unique_filename: false
      });

      const urlImagem = upload.secure_url;

      const corpoIssue = `
**Título:** ${titulo}
**Artista:** ${nomeArtista}
**Ano:** ${ano}
**Estilo:** ${estilo}
**Técnica:** ${tecnica}
**Dimensões:** ${dimensoes}
**Materiais:** ${materiais}
**Local:** ${local}
**Descrição:** ${descricao}
**Carteira:** ${carteira}
**Imagem:** ![Obra](${urlImagem})
      `.trim();

      const resposta = await octokit.rest.issues.create({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        title: `Nova Submissão: "${titulo}" por ${nomeArtista}`,
        body: corpoIssue,
        labels: ['obra', 'pendente']
      });

      return res.status(200).json({
        message: 'Submissão recebida com sucesso!',
        issue_url: resposta.data.html_url,
        imagem: urlImagem
      });

    } catch (erro) {
      console.error('[ERRO] Erro ao criar a issue:', erro);
      return res.status(500).json({ message: 'Erro interno ao processar a submissão' });
    }
  });
}
