// File: /api/submit.js

import formidable from 'formidable';
import fs from 'fs';
import fetch from 'node-fetch';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const form = formidable({ multiples: false });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Erro ao processar o formulário:', err);
      return res.status(500).json({ message: 'Erro ao processar o formulário' });
    }

    const { titulo, descricao, enderecowallet } = fields;
    const imagem = files.imagem;

    if (!titulo || !descricao || !enderecowallet || !imagem) {
      return res.status(400).json({ message: 'Todos os campos são obrigatórios' });
    }

    // Apenas o nome da imagem é usado neste exemplo
    const nomeImagem = imagem.originalFilename || imagem.newFilename || 'imagem.jpg';

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const REPO = 'nandart/nandart-submissoes';

    const issueBody = `
**🎨 Título da Obra:** ${titulo}
**🖋️ Descrição:**  
${descricao}

**🏦 Endereço da Wallet:** ${enderecowallet}
**🖼️ Imagem Submetida:** ${nomeImagem}
`;

    try {
      const response = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github+json',
        },
        body: JSON.stringify({
          title: `Nova Obra: ${titulo}`,
          body: issueBody,
        }),
      });

      if (!response.ok) {
        const erro = await response.text();
        console.error('Erro na resposta do GitHub:', erro);
        return res.status(500).json({ message: 'Erro ao criar issue no GitHub' });
      }

      res.status(200).json({ message: 'Submissão recebida com sucesso!' });

    } catch (error) {
      console.error('Erro inesperado:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });
}
