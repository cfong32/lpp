import os
import pickle

import keras

# abbreviations (shorten name) to be put in file names
abbr = {'pre_dense_size': 'ebsz',
        'pre_dense_bn': 'bn',
        'pre_dense_activation': 'ebatv',
        'num_lstm_lyrs': 'lstm',
        'lstm_state_size': 'z',
        'dropout_rate': 'dr',
        'output_dense_size': 'tag',
        'output_activation': 'outatv',
        'epoch': 'ep'
        }


def params_to_filename(params, prefix='', root_dir='', ext=''):
    """Construct a file name by using the parameters given
    """
    abbr_params = []
    for param, value in params.items():
        if param in abbr:
            abbr_params.append(f'_{abbr[param]}_{value}')
        else:
            abbr_params.append(f'_{param}_{value}')

    file_name = prefix + ''.join(abbr_params)
    return os.path.join(root_dir, file_name) + ext


def save_model_and_history(model, history, save_path):
    """Save model as well as the training history to a path
    extension will be added,
    becoming [save_path].h5 and [save_path].pkl"""
    if  save_path[-3:] == '.h5':
        h5_path = save_path
        pkl_path = save_path[:-3] + '.pkl'
    else:
        h5_path = save_path + '.h5'
        pkl_path = save_path + '.pkl'

    model.save(h5_path)
    pickle.dump(history.history, open(pkl_path, 'wb'))


def save_model_and_history_by_params(model, history, params, prefix='', root_dir=''):
    """Save model as well as the training history to a path
    which is constructed using the parameters given, for example:
    lstm_ebsz_0_bn_False_ebatv_relu_lstm_2_z_20_dr_0.1_tag_3_outatv_None_ep_110.h5 """
    file_name = params_to_filename(params, prefix=prefix, root_dir=root_dir)
    h5_path = file_name + '.h5'
    pkl_path = file_name + '.pkl'
    model.save(h5_path)
    pickle.dump(history.history, open(pkl_path, 'wb'))


def load_history_by_params(params, prefix='', root_dir=''):
    pkl_path = params_to_filename(params, prefix=prefix, root_dir=root_dir, ext='.pkl')
    return pickle.load(open(pkl_path, 'rb'))


def load_model_by_params(params, prefix='', root_dir='', *args, **kwargs):
    h5_path = params_to_filename(params, prefix=prefix, root_dir=root_dir, ext='.h5')
    return keras.models.load_model(h5_path, *args, **kwargs)


"""Test
"""
if __name__ == '__main__':
    p = {'pre_dense_size': 8,
         'pre_dense_bn': False,
         'pre_dense_activation': 'relu',
         'num_lstm_lyrs': 2,
         'lstm_state_size': 30,
         'dropout_rate': 0.1,
         'output_dense_size': 3,
         'output_activation': None,
         }
    output = params_to_filename(p, prefix='rnn')
    expected = 'rnn_ebsz_8_bn_False_ebatv_relu_lstm_2_z_30_dr_0.1_tag_3_outatv_None'
    assert output == expected
