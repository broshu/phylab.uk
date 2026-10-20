---
id: he-2026-bert-scoring-transfer
status: pending
title: "Automated scoring of constructed responses: BERT performance on near- and far-transfer biochemistry problems"
authors:
  - "Cheng-Wen He"
  - "Peng He"
  - "Tingting Li"
  - "Logan Fiorella"
  - "Paula P. Lemons"
year: 2026
published_date: 2026-10-19
source: "Journal of Science Education and Technology"
doi: 10.1007/s10956-026-10362-0
url: https://doi.org/10.1007/s10956-026-10362-0
added: 2026-10-20
proposed_by: Claude
score: 4
topics: [ai, assessment, transfer]
reading_priority: read
evidence_type: "Automated-scoring validation study"
---
## Why recommended

比较 AI 自动评分在近迁移和远迁移题上与专家评分的一致性，并分析评错的原因，可直接参考到你的 AI 阅卷与人工阅卷对比实验。

## Summary

研究用 BERT 多任务模型给 792 名本科生的生物化学迁移题作答评分，并与专家人工评分比较。近迁移题准确率 0.91，远迁移题降至 0.87；学生答案含糊、使用其他合理推理或非规范观点时，模型更容易与人工不一致。

## Key finding A

An AI scoring model matched expert human scores well on near-transfer biochemistry problems but less well on far-transfer ones. It struggled most with vague, unconventional or alternative but valid reasoning.

> AI 评分模型在近迁移生化题上与专家评分高度一致，在远迁移题上较差，尤其难以处理含糊、非常规或另辟蹊径但合理的推理。

## Key finding B

Trained on responses from 792 undergraduates, a BERT multi-task classifier reached 0.91 overall accuracy on near-transfer rubric categories and 0.87 on far-transfer ones, with weakest performance on evidence use and novel claims. Its three-class output limited sensitivity to graded accuracy.

> 基于 792 名本科生的作答训练，BERT 多任务分类器在近迁移评分类别上的总体准确率为 0.91，远迁移为 0.87，证据使用和新主张类别最弱；三级输出结构限制了对精确程度的区分。

## PhD relevance

Use its error categories to analyse where AI grading of your students’ physics answers disagrees with teachers, separating near- and far-transfer items.

> 可用其误判类型分析 AI 阅卷与教师评分在你学生物理答卷上的分歧，并区分近迁移与远迁移题目。

## Reading recommendation

Read the rubric categories and the qualitative analysis of misalignments.

> 精读评分类别和对不一致情况的质性分析。

## Limitations

Undergraduate biochemistry with a fine-tuned BERT model rather than a general large language model, so results may not carry over to physics or to current chatbots.

> 对象为本科生物化学，使用微调 BERT 而非通用大模型，结论未必适用于物理或当前的聊天机器人。

## Abstract

Automated scoring tools have shown promise for assessing student scientific reasoning at scale, but their application to evaluating students’ transfer of learning to new contexts remains understudied. This study examined how well a BERT-based multi-task classification model (Bidirectional Encoder Representations from Transformers, BERT) reproduced expert human scoring of undergraduate responses to near- and far-transfer problems in biochemistry, with a focus on noncovalent interactions. Using responses from 792 students, we trained and evaluated the model across six rubric categories for near-transfer problems and five categories for far-transfer problems. Quantitative results indicated strong model performance in near-transfer contexts (overall accuracy = 0.91) across all categories except for the high-quality claim category. Performance declined in far-transfer contexts (overall accuracy = 0.87), particularly in categories involving evidence use and claims for new interaction predictions, but remained robust overall. Qualitative thematic analysis showed that the model aligned with human raters when student responses used discipline-specific vocabulary and explicit, unambiguous reasoning. Misalignments occurred when responses involved vague claims, alternative but valid reasoning, superficial scientific language, non-normative ideas, or missed contextual information. The model also showed limited sensitivity to graded levels of scientific accuracy due to the use of a three-class output structure. Together, these findings demonstrate the potential of BERT-based models to support automated scoring of near-transfer problems while highlighting key challenges in analyzing student thinking in far-transfer contexts.

> 自动评分工具在大规模评估学生科学推理方面已显示出潜力，但用它们评估学生把所学迁移到新情境的能力仍缺乏研究。本研究考察了一个基于 BERT 的多任务分类模型（BERT，即来自 Transformer 的双向编码器表征）在多大程度上能重现专家对本科生生物化学近迁移和远迁移问题作答的人工评分，重点是非共价相互作用。我们使用 792 名学生的作答，针对近迁移问题的六个量规类别和远迁移问题的五个类别训练并评估了模型。定量结果表明，模型在近迁移情境中表现很好（总体准确率 = 0.91），除“高质量主张”类别外的所有类别都是如此。在远迁移情境中表现有所下降（总体准确率 = 0.87），尤其是在涉及证据使用和对新相互作用作出预测性主张的类别中，但总体仍然稳健。定性主题分析表明，当学生作答使用学科专门词汇且推理明确、无歧义时，模型与人工评分者一致。当作答包含含糊的主张、另一种但合理的推理、肤浅的科学用语、非规范观点，或遗漏了情境信息时，就会出现不一致。由于采用三分类输出结构，模型对科学准确性的程度差异也不够敏感。总之，这些发现显示了基于 BERT 的模型在支持近迁移问题自动评分方面的潜力，同时也突出了在远迁移情境中分析学生思维的关键挑战。

Source: Cheng-Wen He, Peng He, Tingting Li, Logan Fiorella, Paula P. Lemons. Automated scoring of constructed responses: BERT performance on near- and far-transfer biochemistry problems. J. Sci. Educ. Technol. (2026). https://doi.org/10.1007/s10956-026-10362-0
Abstract retrieved from Crossref. Curatorial summaries above are by Claude, based on the abstract; full text has not been reviewed.
