vibe coding振り返り
実験ノート：Claude Code on the webでDynamic Ontologyをvibe coding

Labeled Property Graph(LPG)を用いたDynamic Ontologyについて最初の考察。まずはClaude 4.5 Sonnetで簡単なデモを作ってもらって、csvファイルをLPGにしてそれを別の目的のLPGに変換する様子をvibe coding、最後にSonnetに例題をつかった、インタラクティブデモを作ってもらった

実験ノート：Claude Code on the webでDynamic Ontologyをvibe coding(2)

前のvibe coding結果に基づき、これを汎用的なフレームワークとしての実装を、Claude Code on the webで試行。結果、csv群に対して、メタデータを準備し、変換ルールをちゃんと描けば、Labeled Property Graph(LPG)を使った、知識（データ）の変換が、結構汎用的にできるようになった。

考察ノート：Property Graphを用いたDynamic Ontologyの形式化

前および前々のvibe codingの結果を振り返り、Dynamic ontologyが、下位のオントロジーに要素や関係性を追加してくことで上位のオントロジーに発展していくような仕組みとして、これの定式化、オントロジーの操作を演算体系にするように、ChatGPTにお願いした。ChatGPTは基本演算を明らかにし、して、Cypherでの実現例を示してくれた。人やLLMに優しくということで、DSL(ドメイン特化言語）を粗に作ってもらい、その言語使用およびCypherへの展開仕様をまとめてもらった。

実験ノート：Claude Code on the webでDynamic Ontologyをvibe coding(3)

前回の、Labeled Property Graph(LPG)を使ったdynamic ontologyの形式化およびDSLの導入に対し、このDSLの処理系とデモをClaude Code on the webで実施。意外と簡単に作ってもらえたが、cyhperは、neo4jなどを使わねば確かめられないので、デバグに時間がかかったが、処理系ができてまった。

考察ノート：Dynamic OntologyのDSLの確認、ChatGPTはDSLを設計し、Claude Code on the webがDSL処理系を実装(vibe coding結果の読み解き）

さすがに、前回のDSLの実装。中身を精査していないので、この精査を実施、途中neo4jの使い方を学びながら、csvからGHGレポートを作成するというデモシナリオに従って、DSLで記述された操作が、どのようにcypherに展開され、このcypherをneo4jで動かしてみて確認を行った。vibe coding結果を学習するというそういうパターン回

考察ノート：Claude Code on the webでMDA(Model Driven Architecture)をvibe codingして、20年まえの修士レベル論文を検証。

20年前の自分の社会人博士課程でのサブテーマ論文である、MDA(モデル駆動アーキテクチャ）によるデータ変換に関して、これをClaude Code on the webで実現できることを検証。理論的な面として、Macro Tree Transducerでデータ変換を形式化していたものを、以前vibe codingした自作（いやvibe codingなので自作とは言えないか）のMacro Tree Transducer)の仕様を使い、csvからGHGレポート生成事例の変換がMTTの実装をつかって実現できるかをChatGPTに聞いてみて、概ねできるが一部役不足という結果を得た。

以上を振り返ると、Dynamic ontologyは、データの変換の手段であり、データ変換には、データを木と見做したときそのモデル(ontology)間の関係性から導き出されたルールをつかって実現できるとう面もある。前者は、ontologyに対するLPGの操作としてのDSLによる操作列として変換を実現し、後者はルール群すなわち、Macro Tree Transducerとして実現できる。

同じ目的なのに、異なる定式化と実現手段という話であるが、今後の方向性として、これらがどのように関係するかの理論の検討があるだろう。そして双方とも生成AIを使えばルールの生成、DSLによる操作列を生成されてしまうという現実がある。

はたして、どのような理論がありうるか、