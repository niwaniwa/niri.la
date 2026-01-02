---
title: "Markdown 表示テスト"
description: "Markdown 表示テスト"
pubDate: 2026-01-02
tags: ["astro", "blog"]
draft: false
image: "https://media.niri.la/misskey/acbd03ac-25bc-46d0-b70c-3762266a835b.webp"
---

このファイルは **Markdown の主要な装飾要素** を確認するためのサンプルです。[^1]

[^1]: ここが脚注1の内容です。

---

## 1. 見出し（Headers）

# 見出し1（H1）

## 見出し2（H2）

### 見出し3（H3）

#### 見出し4（H4）

##### 見出し5（H5）

###### 見出し6（H6）

---

## 2. 文字装飾（Text Formatting）

- **太字（Bold）**
- _斜体（Italic）_
- **_太字＋斜体_**
- ~~取り消し線~~
- `インラインコード`
- <u>下線（HTML）</u>

---

## 3. 箇条書きリスト（Lists）

### 箇条書き（Unordered）

- アイテム1
  - サブアイテム1
  - サブアイテム2
- アイテム2
- アイテム3

### 番号付きリスト（Ordered）

1. 項目1
2. 項目2
   1. サブ項目
   2. サブ項目
3. 項目3

---

## 4. チェックボックス（タスクリスト）

- [x] 完了したタスク
- [ ] 未完了のタスク
- [ ] 進行中のタスク

---

## 5. 引用（Blockquote）

> これは引用文です。
>
> 複数行の引用も可能です。

---

## 6. コードブロック

### インラインコード

`console.log("Hello World");`

### 複数行コード（言語指定あり）

```javascript
function greet(name) {
  console.log(`Hello, ${name}!`);
}
greet("World");
```

## 7. 表（Table）

| 項目 | 説明     | 備考     |
| ---- | -------- | -------- |
| 名前 | サンプル | テスト用 |
| 年齢 | 20       | 仮       |
| 状態 | 有効     | -        |

---

## 8. リンクと画像

### リンク

[Misskey](https://misskey.niri.la)

### 画像

![サンプル画像](https://media.niri.la/misskey/2ccc485c-0e36-4b86-94e7-b19d6833dacd.png)

---

## 9. 水平線

---

---

## 10. HTML混在

<div style="border:1px solid #ccc; padding:10px;">
  <strong>HTMLタグ</strong>も使えます。
</div>

---

## 11. エスケープ文字

\* アスタリスク
\# シャープ
\` バッククォート

---

## 12. 数式（対応環境のみ）

インライン数式：
$E = mc^2$

ブロック数式：

$$
\int_0^1 x^2 dx = \frac{1}{3}
$$

---

## 13. 脚注（対応環境のみ）

これは脚注の例です。[^2]

[^2]: ここが脚注2の内容です。

---

## 14. 終わりに

このファイルは Markdown 表示確認用の サンプル です。
