import keras.backend as K
import tensorflow as tf
from keras.layers import Dense, LSTM, BatchNormalization, TimeDistributed, Activation, Lambda
from keras.models import Sequential
from keras.optimizers import Adam

eps = 1e-5


def lstm_model(params, input_shape):

    pre_dense_size = params['pre_dense_size']
    pre_dense_bn = params['pre_dense_bn']
    pre_dense_activation = params['pre_dense_activation']
    num_lstm_lyrs = params['num_lstm_lyrs']
    lstm_state_size = params['lstm_state_size']
    dropout_rate = params['dropout_rate']
    output_dense_size = params['output_dense_size']
    output_activation = params['output_activation']

    model = Sequential()
    next_shape = (num_time_steps, num_features) = input_shape

    if pre_dense_size:
        model.add(TimeDistributed(Dense(pre_dense_size),
                                  input_shape=next_shape))
        if pre_dense_bn:
            model.add(BatchNormalization())
        model.add(Activation(pre_dense_activation))
        next_shape = (num_time_steps, pre_dense_size)

    for i in range(num_lstm_lyrs):
        model.add(LSTM(lstm_state_size,
                       unroll=True,
                       return_sequences=True,
                       dropout=dropout_rate,
                       input_shape=next_shape))
        next_shape = (num_time_steps, lstm_state_size)

    model.add(Dense(output_dense_size))
    model.add(Activation(output_activation))
    model.add(Lambda(lambda x: K.clip(x, 0, 1)))

    model.compile(loss=nan_mse,
                  metrics=[nan_r2, band1_recall, band2_recall, band3_recall],
                  optimizer=Adam())

    model.summary()
    return model


def nan_mse(y_true, y_pred):
    y_diff = y_pred - y_true
    y_diff = tf.where(tf.is_nan(y_true), tf.zeros_like(y_diff), y_diff)
    return K.mean(K.square(y_diff))


def nan_r2(y_true, y_pred):
    y_is_nan = tf.is_nan(y_true)
    zeros_like_y = tf.zeros_like(y_true)
    y_true = tf.where(y_is_nan, zeros_like_y, y_true)
    y_pred = tf.where(y_is_nan, zeros_like_y, y_pred)

    residual = tf.reduce_sum(tf.square(y_true - y_pred))
    total = tf.reduce_sum(tf.square(y_true - tf.reduce_mean(y_true, axis=0)))
    r2 = 1.0 - tf.divide(residual, total)
    return r2


def band_recall(lbound, ubound):
    def metric(y_true, y_pred):
        y_true_band = tf.logical_and(y_true >= lbound, y_true < ubound)
        y_pred_band = tf.logical_and(y_pred >= lbound, y_pred < ubound)
        y_true_pos = tf.logical_and(y_true_band, y_pred_band)

        num_true_pos = K.sum(tf.cast(y_true_pos, tf.float32))
        num_true_total = K.sum(tf.cast(y_true_band, tf.float32))
        return num_true_pos / num_true_total

    return metric


def band1_recall(y_true, y_pred):
    return band_recall(0.7 + eps, 1 + eps)(y_true, y_pred)


def band2_recall(y_true, y_pred):
    return band_recall(0.4, 0.7 + eps)(y_true, y_pred)


def band3_recall(y_true, y_pred):
    return band_recall(0, 0.4)(y_true, y_pred)


"""Test
"""
if __name__ == '__main__':
    params = {'pre_dense_size': 8,
              'pre_dense_bn': False,
              'pre_dense_activation': 'relu',
              'num_lstm_lyrs': 2,
              'lstm_state_size': 30,
              'dropout_rate': 0.1,
              'output_dense_size': 3,
              'output_activation': None,}

    model = lstm_model(params,
                       input_shape=(12, 20),
                       bands=[0, .4, .7+eps, 1+eps])

    print('Input Tensor:', model.layers[0].input.name)
    model.summary()
