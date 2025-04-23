import { IncomingForm } from 'formidable';
import { Octokit } from '@octokit/rest';
import { v4 as uuidv4 } from 'uuid';
import slugify from 'slugify';
import fs from 'fs';
import path from 'path';
import cloudinary from 'cloudinary';

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

export const config = {
  api: {
    bodyParser: false
  }
};

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const form = new IncomingForm({ multiples: false, keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('[ERRO] Ao analisar o formulário:', err);
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
      wallet
    } = fields;

    if (!nomeArtista || !titulo || !descricao || !estilo || !tecnica || !ano || !dimensoes || !materiais || !local || !wallet || !files.imagem) {
      return res.status(400).json({ message: 'Todos os campos obrigatórios devem ser preenchidos' });
    }

    const imagemPath = files.imagem.filepath;
    let imagemUrl;

    try {
      const uploadResponse = await cloudinary.v2.uploader.upload(imagemPath, {
        folder: 'nandart',
        use_filename: true,
        unique_filename: false
      });

      imagemUrl = uploadResponse.secure_url;
    } catch (uploadError) {
      console.error('[ERRO] Upload da imagem para Cloudinary:', uploadError);
      return res.status(500).json({ message: 'Erro ao carregar a imagem' });
    }

    const repoOwner = 'Nandart';
    const repoName = 'nandart-submissoes';
    const issueTitle = `Nova Submissão: "${titulo}" por ${nomeArtista}`;
    const slug = slugify(`${nomeArtista}-${titulo}`, { lower: true });

    const corpo = `
**Título:** ${titulo}  
**Artista:** ${nomeArtista}  
**Ano:** ${ano}  
**Estilo:** ${estilo}  
**Técnica:** ${tecnica}  
**Dimensões:** ${dimensoes}  
**Materiais:** ${materiais}  
**Local:** ${local}  
**Descrição:**  
${descricao}

**Carteira:** ${wallet}  
**Imagem:**  
![Obra](${imagemUrl})
    `.trim();

    try {
      await octokit.rest.issues.create({
        owner: repoOwner,
        repo: repoName,
        title: issueTitle,
        body: corpo,
        labels: ['obra', 'pendente']
      });

      return res.status(200).json({ message: 'Submissão recebida com sucesso!', imagemUrl });
    } catch (githubError) {
      console.error('[ERRO] Upload ou criação de issue:', githubError);
      return res.status(500).json({ message: 'Erro ao registar a submissão no GitHub' });
    }
  });
}
