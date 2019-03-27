# coding: utf-8

import tensorflow as tf


def partial_es(Y_idx, X_idx, pred, data_in, epsilon=0.0001):
    """
    The analysis on the single-variable dependency in the neural network.
    The exact partial-related calculation may be highly time consuming, and so the estimated calculation can be used in the bad case.
    Args:
        Y_idx: index of Y to access the target variable of interest
        X_idx: index of X to access the independent variable of a neural network
        data_in: the specified data of input layer
        pred: the specified predictive model
    Returns:
        The first-order derivative of Y on X for the specified X index and Y index
    """
    eps = epsilon
    y1 = pred(data_in)
    data_in[X_idx] += eps
    y2 = pred(data_in)
    
    return (y2[Y_idx] - y1[Y_idx]) / eps


def partial(ys, xs):
    """
    Args:
        ys: A Tensor of tensors to be differentiated with the shape [None, A]
        xs: A Tensor of tensors to be used for differentiation with the shape [None, B, C, D, ...]
    Returns:
        A Tensor with the shape [None, A, B]
    """
    grads = []
    for y in tf.unstack(ys, axis=1):
        grads += tf.gradients(y, xs)
    return tf.stack(grads, axis=1)


def partial_nd(ys, xs, specified_shape=None):
    """
    Args:
        ys: A Tensor to be differentiated with the shape [None, A1, B1, C1, ...]
        xs: A Tensor to be used for differentiation with the shape [None, A2, B2, C2, ...]
        specified_shape: The specified dynamical shape of ys. The first element is dummy as None or -1.
    Returns:
        A Tensor with the shape [None, A1, B1, C1, ..., A2, B2, C2, ...]
    """
    def aux(Y, X, specified_shape=None):
        """Auxiliary function with the depth first search"""
        if len(specified_shape)==1:
            return tf.gradients(Y, X)[0]
        elif len(specified_shape)==2:
            return partial(Y, X)
        else:
            grads = []
            for i in range(specified_shape[1]):
                ret = aux(Y[:, i, :], X, [specified_shape[0]] + specified_shape[2:])
                grads += [ret]
            return tf.stack(grads, axis=1)
    
    inferred_shape = ys.shape.as_list()
    if None not in inferred_shape[1:]:
        return aux(ys, xs, inferred_shape)
    else:
        msg = "The inferred shape {} is not compatiable with the specified shape {}".format(inferred_shape, specified_shape)
        assert len(specified_shape) == len(), msg
        
        res = True
        for i, s in enumerate(inferred_shape):
            if s is not None:
                res &= (specified_shape[i] == s)
        assert res == True, msg
        
        return aux(ys, xs, specified_shape)


def partial_list(ys, xs, specified_shapes=None):
    """
    Args:
        ys: A list of tensors. Each tensor will be differentiated with the partial_nd
        xs: A Tensor to be used for differentiation, or a list of tensors to be used for differentiation with the smae length as ys
        specified_shapes: A list of specified dynamical shapes of ys. The first element of each shape is dummy as None or -1.
    """
    assert (len(ys) > 0) and (len(xs) > 0), "The length of ys is 0"
    if specified_shapes is None:
        if len(xs) == 1:
            return [partial_nd(y, xs) for y in ys]
        else:
            return [partial_nd(y, x) for (y,x) in zip(ys,xs)]
    else:
        if len(xs) == 1:
            return [partial_nd(y, xs, specified_shape) for (y, specified_shape) in (ys, specified_shapes)]
        else:
            return [partial_nd(y, x, specified_shape) for (y,x,specified_shape) in zip(ys,xs,specified_shapes)]
