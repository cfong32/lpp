"""
This contains all functions for pre-process and process after training and prediction
"""
from collections import Counter

import numpy as np
import pandas as pd
from imblearn.over_sampling import RandomOverSampler
from imblearn.under_sampling import RandomUnderSampler
from sklearn.model_selection import train_test_split


def read_xy_pkl(pkl_file_x, pkl_file_y, sample_id, time_step_id, time_steps,
                x_features, y_label, y_add_next, y_add_final,
                x_fill_value=0, y_fill_value=0,
                shuffle_seed=1):
    """Read
    X (input features) and
    Y (output labels) from pickle file into numpy array
    """

    # read dataframes x and y
    df_x = pd.read_pickle(pkl_file_x)
    df_y = pd.read_pickle(pkl_file_y)

    # find common ids
    sids_x = df_x.reset_index()[sample_id].unique()
    sids_y = df_y.reset_index()[sample_id].unique()
    sids = np.intersect1d(sids_x, sids_y)

    # shuffle the sids, which is the index of the output data
    if shuffle_seed:
        np.random.seed(shuffle_seed)
        i = np.random.permutation(range(len(sids)))
        sids = sids[i]

    # reindex dataframes, to fill the missing data with x_fill_value and y_fill_value
    full_index = pd.MultiIndex.from_product([sids.tolist(), time_steps])
    idx = pd.IndexSlice
    df_x = df_x[x_features].reindex(full_index, fill_value=x_fill_value)
    df_y = df_y[[y_label]].reindex(full_index, fill_value=y_fill_value)

    # add a column for "next chapter grade" if needed
    if y_add_next:
        next_label = 'next_' + y_label
        for t in time_steps[:-1]:
            df_y.loc[idx[:, t], next_label] = df_y.loc[idx[:, t + 1], y_label].values

    # add a column for "final grade" if needed
    if y_add_final:
        final_label = 'final_' + y_label
        for t in time_steps:
            df_y.loc[idx[:, t], final_label] = df_y.loc[idx[:, 12], y_label].values

    # convert to np array
    num_tags = 1 + y_add_next + y_add_final
    x = df_x.values.reshape((len(sids), len(time_steps), len(x_features)))
    y = df_y.values.reshape((len(sids), len(time_steps), num_tags))

    return x, y


def split_dataset(x, y, test_size=0.2, random_state=42):
    """Split X and Y into training and test sets,
    optionally followed by certain re-sampling process
    """
    x_train, x_test, y_train, y_test = train_test_split(x, y, test_size=test_size, random_state=random_state)
    return (x_train, y_train), (x_test, y_test)


def random_under_sample(x, y, bands, random_seed=42, sampling_strategy='auto'):
    """Perform random under sampling (RUS) on X and Y
    only under-sample the most populated band if sampling_strategy='biggest_band_only'
    """

    # count all bands
    y_band = band_by_last_value(y, bands)
    counts = Counter(y_band).most_common()

    if sampling_strategy == 'biggest_band_only':
        # reduce the count of the largest band to be the same as the 2nd largest one
        counts[0] = (counts[0][0], counts[1][1])

        # this is the new sampling_strategy
        sampling_strategy = dict(counts)

    rus = RandomUnderSampler(sampling_strategy=sampling_strategy, random_state=random_seed)
    rus.fit_resample(np.zeros_like(y_band).reshape((-1, 1)), y_band)
    idx = rus.sample_indices_
    resampled_x = np.copy(x[idx])
    resampled_y = np.copy(y[idx])

    return resampled_x, resampled_y


def random_over_sample(x, y, bands, random_seed=42, sampling_strategy='auto'):
    """Perform random over sampling (ROS) on X and Y
    only over-sample the least populated band if sampling_strategy='smallest_band_only'
    """

    # count all bands
    y_band = band_by_last_value(y, bands)
    counts = Counter(y_band).most_common()

    if sampling_strategy == 'smallest_band_only':
        # reduce the count of the smallest band to be the same as the 2nd smallest one
        counts.reverse()
        counts[0] = (counts[0][0], counts[1][1])

        # this is the new sampling_strategy
        sampling_strategy = dict(counts)

    ros = RandomOverSampler(sampling_strategy=sampling_strategy, random_state=random_seed)
    ros.fit_resample(np.zeros_like(y_band).reshape((-1, 1)), y_band)
    idx = ros.sample_indices_
    resampled_x = np.copy(x[idx])
    resampled_y = np.copy(y[idx])

    return resampled_x, resampled_y


def band_by_last_value(y_3d, bands):
    """Convert grades: array(n, 12, 3), to band: 1/2/3

    :param bands: boundaries of bands (similar to the idea of bins in histogram)
    :param y_3d: grades, in shape of array(n, 12, 3)
    :return: bands, in shape of array(n)
    """
    band_1d = np.digitize(y_3d[:, -1, -1], bands)
    print(Counter(band_1d))
    return band_1d


def band_all_and_reshape(y_3d, bands):
    band_1d = np.digitize(y_3d.reshape(-1), bands)
    print(Counter(band_1d))
    return band_1d
