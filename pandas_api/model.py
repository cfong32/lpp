import os

import keras.backend as K
import numpy as np
from django.conf import settings
from keras.models import load_model

from coursemodel.modelling import nan_mse, nan_r2, band1_recall, band2_recall, band3_recall
from .partial import *

# loading the keras model
model_path = os.path.join(settings.PROJECT_ROOT, '../pandas_api/static/model/lstm_hkust.h5')
model = load_model(model_path,
                   custom_objects={'nan_mse': nan_mse,
                                   'nan_r2': nan_r2,
                                   'band1_recall': band1_recall,
                                   'band2_recall': band2_recall,
                                   'band3_recall': band3_recall})

# mapping input and output node names to X_ph and Y_out
sess = K.get_session()
X_ph = sess.graph.get_tensor_by_name(model.inputs[0].name)
Y_out = sess.graph.get_tensor_by_name(model.outputs[0].name)


def prediction(x_data):
    out = sess.run(Y_out, feed_dict={X_ph: x_data})
    return out


def partial_analysis(x_data):
    out = sess.run(partial_nd(Y_out, X_ph), feed_dict={X_ph: x_data})
    return out
    

def gather_data(sid):
    data_in = []
    df_sid = df.loc[sid,]    
    for i in range(1,13):
        r = []
        for j in feature_name:
            try:
                value = df_sid.loc[(i,), j].tolist()[0]
            except:
                value = 0
            r += [value]

        data_in += [r]

    return np.expand_dims(np.array(data_in), 0)


def prediction_sid(sid):
    data_in = gather_data(sid)
    y_out = prediction(data_in)
    y_out = y_out.tolist()

    return y_out[0]


def analyze_sid(sid):
    data_in = gather_data(sid)
    dy = partial_analysis(data_in)
    return dy


def suggestion(X_in, chapter, grade_idx=2, ins=0.15, lr=0.005, total_steps = 1500):
    Y_target = prediction(X_in)
    
    f_obj_op = Y_out[:, chapter-1, grade_idx] - (Y_target[:, chapter-1, grade_idx] + ins)
    
    dy_op = partial_nd(f_obj_op, X_ph)
    
    i, loss, eps, sign = 0, 100, 0.002, 1.0
    while(i < total_steps and loss > eps):
        dy = sess.run(dy_op, feed_dict={X_ph: X_in})
        dy = np.clip(dy, 0.0, 1.0)
        X_in += sign * lr * dy
        X_in = np.clip(X_in, 0.0, 1.0)
        f_obj = sess.run(f_obj_op, feed_dict={X_ph: X_in})
        i += 1
        loss = abs(max(f_obj))
        sign = -1.0 if min(f_obj) > 0 else 1.0
        
    print(loss, i)
    Y_pred = prediction(X_in)
    return X_in, Y_pred


def suggestion_sid(sid, chapter, grade_idx=2, ins=0.15, lr=0.005, total_steps = 1500):
    X_in = gather_data(sid)
    
    return suggestion(X_in, chapter, grade_idx, ins, lr, total_steps)


def normFactor(nv_agg, range_chapter, ratio=0.97):
    cut_off = {}
    colnames = nv_agg.columns
    nv_agg.reset_index(drop=False, inplace=True)
    for cn in colnames:
        for i in range_chapter:
            if i not in cut_off:
                cut_off[i] = {}
            cn_chpt = nv_agg.loc[(nv_agg["chapter_id"]==i) & (nv_agg[cn]>0), cn]
            if len(cn_chpt) > 0:
                cut_off[i][cn] = cn_chpt.quantile(ratio)                
            else:
                cut_off[i][cn] = 0
    
    nv_agg.set_index(["user_id", "chapter_id"], inplace=True)
    return cut_off
