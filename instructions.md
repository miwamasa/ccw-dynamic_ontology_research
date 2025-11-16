これは、モデル＝メタデータをつかったデータ変換に関する２つの手法を統一する理論の検討および実証をする。

★バックグラウンドと初期的なResearch Questionである。

reserach_thema/background_and_initial_research_question.md

Dynamic ontologyは、データの変換の手段であり、データ変換には、データを木と見做したときそのモデル(ontology)間の関係性から導き出されたルールをつかって実現できるとう面もある。前者は、ontologyに対するLPGの操作としてのDSLによる操作列として変換を実現し、後者はルール群すなわち、Macro Tree Transducerとして実現できる。

同じ目的なのに、異なる定式化と実現手段という話であるが、今後の方向性として、これらがどのように関係するかの理論の検討があるだろう。

★ChatGPTによる上記Research Questionに対する研究計画
reserach_thema/chatGPTs_research_plan.md

★ChatGPTが生成したドキュメント
reserach_thema/dsl↔mtt_research_pack_dsl_spec_sample_compiler_testcases_paper_outline.md

★参考資料
prior_documents/dynamic_ontology.md　→　dynamic ontologyの解説
prior_documents/DSL_spcification.md　→  dynaic ontologyを実現するDSLの例
prior_documents/MTT_THEORY.md　→データ変換を実現するMacro Tree Transducerの資料。

★サンプルデータ
samples/data →csvデータ
samples/manufacturing-ontology.ttl　→　もととなる工場のデータ管理オントロジー
samples/ghg-report-ontology.ttl　→変換先のGHGレポートオントロジ

