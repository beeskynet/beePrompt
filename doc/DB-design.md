## PK SK
|データタイプ|PK|SK|
|----|----|----|
|チャット履歴|chat#{userid}|chatid(uuid-v4)|
|使用量|usage#{userid}|作成日時(yyyy-mm-dd hh:mm:ss.sssss)|
|ポイント残高|pt#{userid}|ポイント有効期限(yyyy-mm-dd hh:mm:ss.sssss)|
|ポイント残高更新ログ|ptlog#{userid}|ポイント有効期限#作成日時|
|ユーザー設定|settings#{userid}|settings|
|特権ユーザーリスト|privileged-users|privileged-users|

## DataType別概要
#### チャット履歴(chat)

#### 使用量(usage)
ユーザー別のポイント使用量の集計等に使用  
common.save_usage()

**現行仕様（io_type: "in" / "out"）:**
- pk: usage#{userid}
- sk: 作成日時(yyyy-mm-dd hh:mm:ss.sssss)
- dtype: "usage"
- io_type: "in" または "out"
- model: 使用モデル名
- platform: "openai" または "amazon"
- est_token: 推定トークン数
- est_dollar: 推定ドル金額
- est_yen: 推定円金額
- usage_point: 使用ポイント
- dollar_1token: 1トークンあたりのドル価格
- yen_1dollar: 1ドルあたりの円価格
- point_1yen: 1円あたりのポイント
- createdAt: 作成日時(yyyy-mm-dd hh:mm:ss)

**更新仕様（io_type: "search"を追加）:**
Web検索機能を持つモデル（gpt-4o-search-preview等）使用時は、トークン料金とは別に検索料金レコードを作成
- pk: usage#{userid}
- sk: 作成日時(yyyy-mm-dd hh:mm:ss.sssss)
- dtype: "usage"
- io_type: "search"
- model: 使用モデル名
- platform: "openai"
- search_count: 検索回数（通常1）
- search_dollar: 検索ドル金額
- search_yen: 検索円金額
- search_usage_point: 検索使用ポイント
- dollar_1search: 1検索あたりのドル価格
- yen_1dollar: 1ドルあたりの円価格
- point_1yen: 1円あたりのポイント
- createdAt: 作成日時(yyyy-mm-dd hh:mm:ss)

※検索使用時は1回のAPI呼び出しで最大3レコード（in, out, search）が作成される

#### ポイント残高(pt)
生成AI API使用ごとにポイント消費  

#### ポイント残高更新ログ(ptlog)
機能的には利用していない。デバッグ用途のログ

#### ユーザー設定(settings)
各ユーザーが変更可能な設定

#### 特権ユーザーリスト(privileged-users)
特権ユーザーのリスト。Cognitoから取得すると遅いので取得高速化のために保存

## ユーザー設定項目
#### copyChatOnMessageDeleteMode
メッセージ削除モードに入る際にチャットを複製する  


## ポイント更新ロジック
#### 有効残高取得
　引数（ユーザーID）  
・対象の残高レコードを取得  
　現在日時＞残高期限、または残高が負の値  
　　※※プラスとマイナスの残高が同時に存在することはないはずだが一応  

#### 残高更新：残高判定　※API呼び出し前
　引数（ユーザーID、残高レコードリスト、使用ポイント(API入力分)）  
・対象残高レコードを集計して有効残高を算出（マイナス値がありうる）  
・有効残高が使用ポイントを下回る場合、残高不足エラーを返し、API使用中止  

#### 残高更新：ポイント付与(+)　
　引数（ユーザーID、付与ポイント、期限）  
・有効残高がマイナスのレコードがある場合、マイナス残高レコードを古い順に相殺  
　・残高レコードに対する相殺結果、残高0の場合、レコード削除  
　　残高レコードに対する相殺結果、全額相殺し切れない(マイナス残高が残る)の場合、レコード更新  
　・更新ログレコードを登録(レコード削除分についてもログ登録)  
・すべてのマイナス残高レコードを相殺後  
　・残った分の残高付与レコードを追加  
　・更新ログレコードを登録  

#### 残高更新：ポイント使用（事後更新）(-)　※API呼び出し後
　引数（ユーザーID、使用ポイント(API入出力分)）  
・残高レコードがない場合  
　・マイナスの残高レコードを登録  
　・更新ログレコードを登録  
・有効残高レコードから古い順に処理  
　・残高＞(残)使用ポイントの場合  
　　残高レコードを更新（プラスのみ）  
　　更新ログレコードを登録  
　　break  
　・残高<(残)使用ポイントの場合  
　　・最新以外の残高レコードの場合  
　　　残高レコードを削除  
　　　更新ログレコードを登録  
　　・最新の残高レコード(=ループの最後)の場合  
　　　残高レコードを更新（マイナス）  
　　　更新ログレコードを登録  
　・残高=(残)使用ポイントの場合（ほぼありえない）  
　　残高レコードを削除  
　　更新ログレコードを登録  


