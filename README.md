# Smart Image Overlay

Plugin WordPress que aplica um overlay inteligente em miniaturas com base no brilho e na transparência da imagem.

## O que é

O *Smart Image Overlay* analisa programaticamente miniaturas exibidas no painel WordPress (ex.: campos de imagem do Meta Box e itens da biblioteca de mídia) que possuam fundos transparentes relevantes e aplica automaticamente um overlay de fundo apropriado para melhorar contraste e legibilidade.

## Funcionalidades

- Detecta imagens SVG que usam `currentColor` e trata-as adequadamente.
- Analisa uma versão reduzida (bitmap) da imagem para estimar brilho médio e transparência.
- Aplica um overlay de cor/alpha apropriado via variável CSS.
- Funciona sem dependências externas e roda no admin do WordPress.
- Funciona com a Media Library e também com as caixas do plugin Meta Box.

## Instalação

1. Copie a pasta do plugin para `wp-content/plugins/kv-smart-image-overlay`.
2. Ative o plugin em **Plugins → Plugins instalados** no painel WordPress.

Não há tela de configurações — o script roda automaticamente nas páginas do admin onde os seletores alvo aparecem.

## Desenvolvimento

- O código usa `requestIdleCallback` quando disponível para processar imagens sem bloquear a UI.
- Há cache simples para SVGs e uma fila para processar itens adicionados dinamicamente (MutationObserver).
- Teste em telas do admin que exibam miniaturas (por exemplo: campos de upload do Meta Box, Biblioteca de Mídia).

## Licença

Este projeto está licenciado sob a licença MIT — veja o arquivo [LICENSE](LICENSE) para o texto completo.
Sintese: você pode usar, copiar, modificar e distribuir este código livremente, desde que mantenha o aviso de copyright e a licença.

## Autor

Kevin Villanova
