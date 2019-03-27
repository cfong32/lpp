# Learning performance predictor visualization frontend & backend

## Setup
- install python 3.X

## Deployment
1. Add the server ip address or domain name to ALLOWED_HOSTS in ./vis_server/settings.py
2. then run following commands:
```bash
# create and use virtualenv
pip install virtualenv
virtualenv venv
source venv/bin/activate

pip install -r requirements.txt

python manage.py runserver 0.0.0.0:7070
```
Open your browser and go to http://localhost:7070/demo/index.html and you should be able to access the frontend.

## Training
A python package ```coursemodel``` is added to train a model for prediction.
Training steps are as follow:
```
from coursemodel.training import train_and_save_model

pkl_file_x = './data/join_nv_chapter_normalized(0309).pkl'
pkl_file_y = './data/p2_chapter_grade_filtered.pkl'
save_path = './../pandas_api/static/model/lstm_hkust'
train_and_save_model(pkl_file_x, pkl_file_y, save_path)
```
After training is finished,  two files will be generated:
1. lstm_hkust.h5 (keras model)
2. lstm_hkust.pkl (keras history object, which are the learning curves)