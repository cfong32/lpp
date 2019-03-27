import pandas as pd
from sklearn.preprocessing import MinMaxScaler
from xgboost import XGBRegressor
import os
from django.conf import settings
import numpy as np
from functools import lru_cache

RANDOM_STATE = 42


def get_path(course, file):
    return os.path.join(settings.PROJECT_ROOT, '..', 'pandas_api', 'static', 'mit', course, file)


@lru_cache(maxsize=32)
def load_data(course):
    # Loading the final grade and the student list
    final_grades = pd.read_csv(get_path(course, 'final_grades.csv'), index_col='user_id')

    course_feature = pd.read_csv(get_path(course, 'coursewised_feature.csv'),
                                 index_col='user_id').fillna(0)

    # cg = pd.read_csv(get_path(course, 'chapter_grades.csv'))
    # cg = cg.pivot(index='user_id', columns='chapter_mid', values='chgrade').fillna(0)

    cv = pd.read_csv(get_path(course, 'chapter_videos.csv'))
    cv = cv.pivot(index='user_id', columns='chapter_name', values='video_count').fillna(0)

    # note that the above dfs have same index 'user_id'

    # # merge the course_videos and course_grades
    # features = \
    # cg.join(cv, on=None, how='outer', lsuffix='_grade', rsuffix='_video_count').fillna(0)

    features = cv

    # full outer join on cv.user_id = course_feature.user_id
    features = features.join(course_feature, how='outer').fillna(0)

    # final_grades is y-data => left outer join on final_grades.user_id = features.user_id
    df = final_grades.join(features, how='left').fillna(0)

    # exclude the 'final_grade' and 'nproblem_check'
    X = df.drop(['final_grade', 'nproblem_check', 'username'], axis=1)
    y = df['final_grade']

    return X, y


def get_user_chapter_grades(course, user_id):
    chapter_grade = pd.read_csv(get_path(course, 'chapter_grade.csv'), index_col=['user_id', 'chapter_id'])
    result = []
    for chapter_id, chapter_grade in chapter_grade.loc[user_id]['chapter_grade'].iteritems():
        result.append({"name": "Chapter "+str(chapter_id), "score": chapter_grade})
    return result


def main():
    course = 'VJx__VJx_2__3T2016'
    filename = 'model.xgb'
    X, y = load_data(course)

    # Normalization
    scaler = MinMaxScaler()
    scaler.fit(X)
    X = scaler.transform(X)

    model = XGBRegressor()
    if os.path.isfile(filename):
        model.load_model(filename)
    else:
        model.fit(X, y)
        model.save_model(filename)
    y_ = model.predict(X)
    print(y_)


model_cache = {}
data_transformer = {}


def predict(course_code, user_id):
    filename = get_path(course_code, '%s_model.xgb' % course_code)

    X, y = load_data(course_code)

    user_X = X.loc[user_id]

    # Normalization
    if course_code not in data_transformer:
        scaler = MinMaxScaler()
        scaler.fit(X)
        data_transformer[course_code] = scaler
    scaler = data_transformer[course_code]

    if course_code not in model_cache:
        model = XGBRegressor()
        if os.path.isfile(filename):
            model.load_model(filename)
        else:
            X = scaler.transform(X)
            model.fit(X, y)
            model.save_model(filename)
        model_cache[course_code] = model

    model = model_cache[course_code]
    X = scaler.transform(X)

    y_ = model.predict(X)
    hist, bin_edges = np.histogram(y_, bins=10, range=[0, 1])

    return {
        "classFinalExamDistribution": hist.tolist(),
        "myChapterScore": get_user_chapter_grades(course_code, user_id),
        "myPredictedFinalExamScore": float(model.predict(user_X)[0])
    }


if __name__ == '__main__':
    main()
