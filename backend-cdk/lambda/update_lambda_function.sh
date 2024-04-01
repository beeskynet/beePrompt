#!/bin/sh
# $1 = lambda python src code path
# $2 = Project Name. 例: aya-20231230
region_initial=AP
func_name="$2-$region_initial-"`basename $1 | sed 's/\.[^\.]*$//'`
dir=`echo $1 | sed 's|/.*$||'`
cp $1 work
cd work
zip $func_name.zip `basename $1`
# common.pyがあれば追加
common_py_path="../$dir/common.py"
if [ -e $common_py_path ]; then
  cp $common_py_path .
  zip $func_name.zip common.py
fi
aws lambda update-function-code --function-name $func_name --zip-file fileb://$func_name.zip --publish $3 $4
