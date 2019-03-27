"""
For training and saving a model
"""
from keras.callbacks import EarlyStopping

from coursemodel.modelling import lstm_model
from coursemodel.preprocessing import random_under_sample, random_over_sample
from coursemodel.preprocessing import read_xy_pkl, split_dataset
from coursemodel.saving import save_model_and_history

# Reading course data
eps = 1e-5
bands = [0, .4, .7 + eps, 1 + eps]
time_steps = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
x_features = ['seq_next', 'seq_prev', 'hide_transcript', 'load_video',
              'pause_video', 'play_video', 'seek_backward', 'seek_forward',
              'show_transcript', 'stop_video', 'seq_next_post', 'seq_prev_post',
              'hide_transcript_post', 'load_video_post', 'pause_video_post', 'play_video_post',
              'seek_backward_post', 'seek_forward_post', 'show_transcript_post', 'stop_video_post']


def train_and_save_model(pkl_file_x, pkl_file_y, save_path):

    # reading and splitting data
    x, y = read_xy_pkl(pkl_file_x=pkl_file_x,
                       pkl_file_y=pkl_file_y,
                       sample_id='user_id',
                       time_step_id='chapter_id',
                       time_steps=time_steps,
                       x_features=x_features,
                       y_label='chapter_grade',
                       y_add_next=True,
                       y_add_final=True)
    (x_train, y_train), (x_test, y_test) = split_dataset(x, y)
    x_train, y_train = random_under_sample(x_train, y_train, bands, sampling_strategy='biggest_band_only')
    x_train, y_train = random_over_sample(x_train, y_train, bands, sampling_strategy='smallest_band_only')

    # training model
    params = {'pre_dense_size': 8,
              'pre_dense_bn': False,
              'pre_dense_activation': 'relu',
              'num_lstm_lyrs': 2,
              'lstm_state_size': 30,
              'dropout_rate': 0.1,
              'output_dense_size': 3,
              'output_activation': None,
              }
    model = lstm_model(params,
                       input_shape=(len(time_steps), len(x_features)))

    initial_epoch = 0
    max_epoch = 500
    history = model.fit(x_train, y_train,
                        validation_data=(x_test, y_test),
                        initial_epoch=initial_epoch,
                        epochs=max_epoch,
                        verbose=2,
                        callbacks=[EarlyStopping(monitor='val_loss',
                                                 mode='min',
                                                 patience=20,
                                                 verbose=1,
                                                 restore_best_weights=True)])

    save_model_and_history(model, history, save_path)
