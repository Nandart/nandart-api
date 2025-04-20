// File: /api/submit.js

import formidable from 'formidable';
import fs from 'fs/promises';
import { v2 as cloudinary } from 'cloudinary';
import path from 'path';
import os from 'os';

export const config = {
  api: {
    bodyParser: false,
  },
};

// ⚙️ Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default async function handler(req, res) {
  console.log('[LOG] Endpoint /api/submit foi chamado');

  if (req.method !== 'POST') {
    console.warn('[ERRO] Método não permitido');
    return res.status(405).json({ message: 'Método não permitido' });
  }

  // ⚙️ Processar formulário com Promessa
  const parseForm = () =>
    new Promise((resolve, reject) => {
      const form = formidable({
        uploadDir: os.tmpdir(), // usar diretório temporário do sistema
        keepExtensions: true,
      });

      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

  try {
    const { fields, files } = await parseForm();
    const { titulo, descricao, enderecowallet } = fields;
    const imagem = files.imagem;

    console.log('[LOG] Campos recebidos:', { titulo, descricao, enderecowallet });
    console.log('[LOG] Info da imagem:', imagem);

    if (!titulo || !descricao || !enderecowallet || !imagem) {
      return res.status(400).json({ message: 'Todos os campos são obrigatórios' });
    }

    // ⚙️ Obter caminho absoluto
    const localFilePath = imagem[0]?.filepath || imagem.filepath || imagem.path;

    if (!localFilePath) {
      throw new Error('Caminho do ficheiro não encontrado');
    }

    // 📤 Fazer upload para o Cloudinary
    const uploadResponse = await cloudinary.uploader.upload(localFilePath, {
      folder: 'nandart-submissoes',
      use_filename: true,
      unique_filename: false,
      resource_type: 'image',
    });

    console.log('[LOG] Upload bem-sucedido:', uploadResponse.secure_url);

    // ✅ Sucesso
    return res.status(200).json({
      message: 'Submissão recebida com sucesso!',
      imageUrl: uploadResponse.secure_url,
    });
  } catch (error) {
    console.error('[ERRO] Falha no processamento:', error);
    return res.status(500).json({ message: 'Erro ao fazer upload da imagem', details: error.message });
  }
}
