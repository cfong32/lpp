from django.shortcuts import render
from django.http import HttpResponse
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
import numpy as np
import pandas as pd
from scipy import stats
import json, os, math, datetime
import copy

from pandas_api import mit_model
from .model import prediction, normFactor, partial_analysis, suggestion
from .util import *


# Create your views here.
dir_course = "HKUSTx-COMP102x-2T2014"
name_grade = os.path.join(settings.PROJECT_ROOT, '../pandas_api/static/{}/chapter_grade_filtered.csv'.format(dir_course))
name_nv = os.path.join(settings.PROJECT_ROOT, '../pandas_api/static/{}/join_nv_chapter.pkl'.format(dir_course))
name_pred_grade = os.path.join(settings.PROJECT_ROOT, '../pandas_api/static/{}/export.csv'.format(dir_course))
name_cutoff = os.path.join(settings.PROJECT_ROOT, '../pandas_api/static/{}/cut_off.json'.format(dir_course))

# Course Info
file_structure =  os.path.join(settings.PROJECT_ROOT, '../pandas_api/static/{}/course_struct.csv'.format(dir_course))
file_feature = os.path.join(settings.PROJECT_ROOT, '../pandas_api/static/{}/feature.json'.format(dir_course))
file_feature_detail = os.path.join(settings.PROJECT_ROOT, '../pandas_api/static/{}/feature_detail.csv'.format(dir_course))
file_feature_info = os.path.join(settings.PROJECT_ROOT, "../pandas_api/static/{}/feature_info.json".format(dir_course))

target_vals = ["chapter_grade", "predicted_final_exam_grade"]
range_chapter = [1,2,3,4,5,6,7,8,9,10,11,12]
target_name = ["chapter_grade"]
feature_name = ["seq_next", "seq_prev", "hide_transcript", "load_video", "pause_video", "play_video", "seek_backward", "seek_forward", "show_transcript", "stop_video"] + ["seq_next_post", "seq_prev_post", "hide_transcript_post", "load_video_post", "pause_video_post", "play_video_post", "seek_backward_post", "seek_forward_post", "show_transcript_post", "stop_video_post"]

df_nv = pd.read_pickle(name_nv).reset_index().groupby(["user_id", "chapter_id"]).sum()
df_pred = pd.read_csv(name_pred_grade).set_index(["user_id", "chapter_id"])

for col in df_pred.columns:
    df_pred[col] = df_pred[col].map(lambda x: max(min(x, 1.0), 0.0))

IDSet = df_pred.reset_index().user_id.unique()
df_nv = df_nv.loc[(IDSet, slice(None)), :]

# cut_off = normFactor(df_nv, range_chapter, ratio=0.97)
cut_off = {}
with open(name_cutoff, "r") as f:
    for k, v in json.load(f).items():
        cut_off[int(k)] = v



# df_nv = df_nv.join(df_pred)

df_nv = pd.concat([df_pred, df_nv], join="outer", axis = 1)

df_grade = pd.read_csv(name_grade).set_index(["user_id", "chapter_id"])
df_grade = df_grade.loc[(IDSet, slice(None)), :]
df_course = pd.concat([df_grade, df_nv], join="outer", axis = 1)
final_exam = 12


df_course = df_course.loc[(slice(None),range_chapter), :]

@csrf_exempt
def getFeatureInfo(request):
    r = calFeatureInfo()
    return JsonResponse(json.dumps(r), safe=False)

def calFeatureInfo():
    with open(file_feature_info, "r") as f:
        r = json.load(f)
    return r

@threadpool
@csrf_exempt
def getSummaryByID(request, platform, course_code):
    sid = request.GET.get('user_id')
    imp = request.GET.get("improvement", 15)
    chapter = request.GET.get("chapter", 5)
    percentile = request.GET.get("percent", False)

    sid = int(sid)
    imp = int(imp) / 100.0
    chapter = int(chapter)
    percentile = int(percentile)
    print("time: {}, sid: {}, improvement: {}, Chapter: {}, percentile: {}".format(datetime.datetime.utcnow(), sid, imp, chapter, percentile))

    if platform == 'Moodle' and course_code == 'VJx__VJx_2__3T2016':
        return JsonResponse(json.dumps(mit_model.predict(course_code, sid)), safe=False)

    predictedFinalExamDistro = {}
    for c in range_chapter:
        p = calHistFeature(c, "predicted_final_exam_grade", dx=10)
        predictedFinalExamDistro["Chapter {}".format(c)] = [{"score": d[0], "count": d[1]} for d in p]
    
    info = calInfoByID(sid)
    
    myScore = []
    for d in info["chapter_grade"]:
        myScore += [{"name": "Chapter {}".format(d[0]), "score": d[1]}]
    
    myPredictedScore = []
    for d in info["predicted_current_chapter_grade"]:
        myPredictedScore += [{"name": "Chapter {}".format(d[0]), "score": d[1]}]
    
    myPredictedFinalExamScore = []
    for d in info["predicted_final_exam_grade"]:
         myPredictedFinalExamScore += [{"name": "Chapter {}".format(d[0]), "score": d[1]}]
         
    
    X_in = gather_data(sid)
    X_in_dc = copy.deepcopy(X_in)
    X_out, Y_out = suggestion(X_in, chapter, ins=imp)
    S = suggestion_stat(X_in_dc, X_out, stat, chapter, percentile, backend=True)        
    res = {"classPredictedFinalExamDistribution": predictedFinalExamDistro,
           "myChapterScore": myScore,
           "myPredictedChapterScore": myPredictedScore,
           "myPredictedFinalExamScore": myPredictedFinalExamScore,
           "recommendation": S[1]
           }
    
    return JsonResponse(json.dumps(res), safe=False)

@csrf_exempt
def getCourseStructure(request):
    r = calCourseStructure()
    return HttpResponse(r)

def calCourseStructure():
    with open(file_structure, "r") as f:
        r = f.read()
    return r


@csrf_exempt
def getFeatureList(request):
    r = calFeatureList()
    return JsonResponse(json.dumps(r), safe=False)

def calFeatureList():
    with open(file_feature, "r") as f:
        r = json.load(f)
    return r


@csrf_exempt
def getFeatureDetail(request):
    r = calFeatureDetail()
    return HttpResponse(r)

def calFeatureDetail():
    with open(file_feature_detail, "r") as f:
        r = f.read()    
    return r


@csrf_exempt
def getHistFeature(request, chapter, featureName):
    chapter = int(chapter)
    r = calHistFeature(chapter, featureName, dx=5)
    return JsonResponse(json.dumps(r), safe=False)

def calHistFeature(chapter, featureName, dx=5):
    dx_n = dx/100.0
    feature_set = list(set([featureName, "chapter_grade"]))
    df1 = df_course.loc[(slice(None), chapter), feature_set].dropna()
    df1["cat"] = df1[featureName].map(lambda x: int(x/dx_n)*dx)
    r = df1.groupby("cat").agg({featureName: "count"}).reset_index()
    r = np.array(r).tolist()
    return r


@csrf_exempt
def getTwoFeatures(request, chapter1, featureName1, chapter2, featureName2):
    chapter1 = int(chapter1)
    chapter2 = int(chapter2)
    
    r = calTwoFeatures(chapter1, featureName1, chapter2, featureName2)    
    return JsonResponse(json.dumps(r), safe = False)


def calTwoFeatures(chapter1, featureName1, chapter2, featureName2):
    idx_chapter = list(set([chapter1, chapter2, final_exam]))
    features = list(set([featureName1, featureName2] + target_vals))
    
    sid_selected = df_grade.loc[(slice(None), chapter2), :].reset_index().user_id.unique()
    
    df = df_course.loc[(sid_selected, idx_chapter), features]
    
    df = df.unstack()
    df = df.fillna(0)
    
    df = df.reset_index()
    
    r = []
    for name in ["user_id", (featureName1, chapter1), (featureName2, chapter2), (target_vals[0], chapter1), (target_vals[0], chapter2), (target_vals[0], final_exam), (target_vals[1], chapter1), (target_vals[1], chapter2)]:
        r += [[np.array(df[name])]]
        
    r = np.transpose(np.concatenate(r)).tolist()
    return r


@csrf_exempt
def getInfoByID(request, sid):
    sid = int(sid)
    r = calInfoByID(sid)
    return JsonResponse(json.dumps(r), safe = False)

def calInfoByID(sid):
    df = df_course.loc[(sid,), ["chapter_grade"] + df_nv.columns.tolist()]
    
    r = {}
    for k in df.columns:
        d = []
        for i in range_chapter:
            if not math.isnan(df.loc[i, k]):
                d += [ [i, df.loc[i, k]] ]
        r[k] = d
    return r


@csrf_exempt
def getFeatureDistroByID(request, sid):
    sid = int(sid)
    # if sid not in IDSet:
    # return HttpResponse(status = 404)
    res = calFeatureDistroByID(sid)
    return JsonResponse(json.dumps(res), safe = False)

def calFeatureDistroByID(sid):
    df = df_course.loc[(sid, range_chapter), df_nv.columns.tolist()].dropna().reset_index().set_index("chapter_id")
    
    res = {}
    for chpt in range_chapter:
        for feature in df.columns:
            try:
                res["{}-{}".format(chpt, feature)] = int(df.loc[(chpt), feature])
            except:
                res["{}-{}".format(chpt, feature)] = 0
                
    return res


@csrf_exempt
def getFeatureDistro(request):
    return JsonResponse(json.dumps(stat), safe = False)


@csrf_exempt
def getTargetDistro(request):    
    res = calTargetDistro()
    return JsonResponse(json.dumps(res), safe = False)

def calTargetDistro():
    res = {}
    for chpt in range_chapter:
        for feature in target_name:
            values = np.array(df_course.loc[(slice(None), chpt), feature].dropna())
            metrics = calMetrics(values)
            res["{}-{}".format(chpt, feature)] = {"values": values.tolist(), "metrics": metrics, "domain": [0, 1], "visible": True}

    return res


@csrf_exempt
def requestNNOutput(request, data):
    data_in = gather_data_from_frontend(data)
    y_out = prediction(data_in)
    y_out = y_out.tolist()[0]
    return JsonResponse(json.dumps(y_out), safe = False)

@threadpool
@csrf_exempt
def requestNNAnalysis(request, data):
    data_in = gather_data_from_frontend(data)
    dy = partial_analysis(data_in)
    dy = dy.tolist()[0]
    return JsonResponse(json.dumps(dy), safe = False)

@threadpool
@csrf_exempt
def genSuggestion(request, sid, chapter, percentile=False):
    sid = int(sid)
    chapter = int(chapter)
    percentile = bool(percentile)
    print("time: {}, sid: {}, chapter: {}, percentile: {}".format(datetime.datetime.utcnow(), sid, chapter, percentile))
    
    X_in = gather_data(sid)
    X_in_dc = copy.deepcopy(X_in)
    X_out, Y_out = suggestion(X_in, chapter)
    S = suggestion_stat(X_in_dc, X_out, stat, chapter, percentile, backend=False)
    X_out = prepare_data_for_frontend(X_out)
    
    return JsonResponse(json.dumps({"X": X_out, "Y": Y_out[0].tolist(), "S": S[0]}), safe = False)



g1 = ["seq_next", "seq_prev", "seq_next_post", "seq_prev_post"]
g2 = ["load_video", "play_video", "load_video_post", "play_video_post"]
g3 = ["pause_video", "seek_backward", "seek_forward", "stop_video", "pause_video_post", "seek_backward_post", "seek_forward_post", "stop_video_post"]
g4 = ["hide_transcript", "show_transcript", "hide_transcript_post", "show_transcript_post"]


def suggestion_stat(X_0, X_1, stat, chapter, percentile=False, backend=False):
    X_0, X_1 = X_0[0], X_1[0]
    res = [[], []]
    for i, c in enumerate(range_chapter):
        if i+1 > chapter:
            break
        
        r = {}
        for j, n in enumerate(feature_name):
            lim = cut_off[c][n]
            x0, x1 = X_0[i][j] * lim, X_1[i][j] * lim
            if percentile:
                if backend:
                    x0 = percentileOfScore(x0, c, n)
                    x1 = percentileOfScore(x1, c, n)
                else:
                    x0 = percentileOfScore(round(x0), c, n)
                    x1 = percentileOfScore(round(x1), c, n)
            metrics = stat["{}-{}".format(c, n)]["metrics"]
            r[n] = (x0, x1, metrics["median"], metrics["count"])
        
        r = suggestion_chapter_level_agg(r, c, percentile)
        if len(r) > 0:
            res[0] += r[0]
            res[1] += [r[1]]
            
    return res[0], res[1]


def suggestion_chapter_level_agg(r, c, percentile=False):
    def aux(group):
        info = None
        
        numer0, numer1, denom, num = 0., 0., 0., 0.
        for n in group:
            if r[n][2] > 0:
                if percentile == False:
                    numer0 += r[n][0]/r[n][2]*r[n][3]
                    numer1 += r[n][1]/r[n][2]*r[n][3]
                else:
                    numer0 += r[n][0]*r[n][3]
                    numer1 += r[n][1]*r[n][3]
                denom += r[n][3]
                num = max(num,  r[n][3])
                
        if denom > 0:
            info = (numer0/denom, numer1/denom)
            
        return [info, num]
        
    msg_n, msg_v, msg_c = "", "", ""
    info_n, info_v, info_c, info_t = {}, {}, {}, {}
    
    s = aux(g1)
    if (s[0] is not None) and s[0][0] <= 0.01:
        msg_n += "You have no activity yet. "
    else:
        active_ins = 0
        if (s[0] is not None) and (s[0][0] != 0):
            active_ins = (s[0][1] / s[0][0] - 1.0) * 100
        if active_ins > 5.0:
            if percentile == False:
                msg_n += "Your current active level in navigation is {:.2f}. You need navigate more than {:.0f}%. ".format(s[0][0], active_ins)
            else:
                msg_n += "Your current active level in navigation is {:.2f}. You need navigate more than {:.0f}%. ".format(s[0][0]/100.0, active_ins)
    
    
    if s[0] is None:
        info_n["currentActiveLevel"] = 0
        info_n["targetActiveLevel"] = 0
    else:
        info_n["currentActiveLevel"] = s[0][0]
        info_n["targetActiveLevel"] = s[0][1]
    info_n["currentRaw"] = {n: r[n][0] for n in g1}
    info_n["TargetRaw"] = {n: r[n][1] for n in g1}
    
    s = aux(g2)
    if (s[0] is not None) and s[0][0] <= 0.01:
        msg_v += "You have not watched video yet. "
    else:
        active_ins = 0
        if (s[0] is not None) and (s[0][0] != 0):
            active_ins = (s[0][1] / s[0][0] - 1.0) * 100
        if active_ins > 5.0:
            if percentile == False:
                msg_v += "Your current active level in video is {:.2f}. You need watch more {:.0f}% videos. ".format(s[0][0], active_ins)
            else:
                msg_v += "Your current active level in video is {:.2f}. You need watch more {:.0f}% videos. ".format(s[0][0]/100.0, active_ins)
    
    if s[0] is None:
        info_v["currentActiveLevel"] = 0
        info_v["targetActiveLevel"] = 0
    else:
        info_v["currentActiveLevel"] = s[0][0]
        info_v["targetActiveLevel"] = s[0][1]
    info_v["currentRaw"] = {n: r[n][0] for n in g2}
    info_v["TargetRaw"] = {n: r[n][1] for n in g2}
    
    
    s = aux(g3)
    active_ins = 0
    if (s[0] is not None) and (s[0][0] != 0):
        active_ins = (s[0][1] / s[0][0] - 1.0) * 100
    if active_ins > 5.0 and s[0][0] >= 0.01:
        if percentile == False:
            msg_c += "Your current concentration level is {:.2f}. When watching the videos, you could pause the video to digest. ".format(s[0][0])
        else:
            msg_c += "Your current concentration level is {:.2f}. When watching the videos, you could pause the video to digest. ".format(s[0][0]/100.0)

    if s[0] is None:
        info_c["currentActiveLevel"] = 0
        info_c["targetActiveLevel"] = 0
    else:
        info_c["currentActiveLevel"] = s[0][0]
        info_c["targetActiveLevel"] = s[0][1]        
    info_c["currentRaw"] = {n: r[n][0] for n in g3}
    info_c["TargetRaw"] = {n: r[n][1] for n in g3}
    
    
    s = aux(g4)
    active_ins = 0
    if (s[0] is not None) and (s[0][0] != 0):
        active_ins = (s[0][1] / s[0][0] - 1.0) * 100
    if active_ins > 5.0 and s[0][0] >= 0.01:
        msg_c += "If necessary, you could read the transcript to understand the content."

    if s[0] is None:
        info_t["currentActiveLevel"] = 0
        info_t["targetActiveLevel"] = 0
    else:
        info_t["currentActiveLevel"] = s[0][0]
        info_t["targetActiveLevel"] = s[0][1]             
    info_t["currentRaw"] = {n: r[n][0] for n in g4}
    info_t["TargetRaw"] = {n: r[n][1] for n in g4}

    
    msgs = []    
    for k, msg in [("Navigation", msg_n), ("Video", msg_v), ("Concentration", msg_c)]:
        if msg != "":
            msgs += [[k, msg]]
    
    if len(msgs) > 0:
        msgs[0] = [[c, len(msgs)]] + msgs[0]

    info = {"name": "Chapter {}".format(c)}
    
    for k, d in [("Navigation", info_n),
                 ("Video", info_v),
                 ("Concentration", info_c),
                 ("Transcirpt", info_t)]:
        if len(d) > 0:
            info[k] = d
    
    return msgs, info




def gather_data_from_frontend(data):
    """ the front-end data -> the back-end data"""
    x_in = [tuple(s.split("=")) for s in data.split("&")]
    x_in = dict(x_in)
    data_in = []
    for i in range_chapter:
        r = []
        for j in feature_name:
            value = float(x_in["{}-{}".format(i, j)])
            lim = cut_off[i][j]
            if lim == 0:
                value = 0
            else:
                value /= lim
            r += [value]
        data_in += [r]
        
    return np.expand_dims(np.array(data_in), 0)



def prepare_data_for_frontend(X_in):
    """ the back-end data -> the front-end data"""
    X_in = X_in[0]
    res = {}
    for i, c in enumerate(range_chapter):
        for j, n in enumerate(feature_name):            
            res["{}-{}".format(c, n)] = round(X_in[i][j] * cut_off[c][n])

    return res


def gather_data(sid):
    data_in = []
    df_sid = df_course.loc[sid,]
    df_sid = df_sid.fillna(0)
    for i in range_chapter:
        r = []
        for j in feature_name:
            try:
                value = df_sid.loc[(i,), j].tolist()[0]
                lim = cut_off[i][j]
                if lim == 0:
                    value = 0
                else:
                    value /= lim
            except:
                value = 0
            r += [value]
            
        data_in += [r]

    return np.expand_dims(np.array(data_in), 0)



def prediction_sid(sid):
    data_in = gather_data(sid)
    y_out = prediction(data_in)
    y_out = y_out.tolist()[0]
    return y_out


def analyze_sid(sid):
    data_in = gather_data(sid)
    dy = partial_analysis(data_in)
    return dy



def calMetrics(values):
    metrics = {"lowerInnerFence": None, "upperInnerFence": None,  "lowerOuterFence": None, "upperOuterFence": None}
    if values.shape[0] == 0:
        metrics["count"] = 0
        metrics["min"] = 0
        metrics["quartile1"] = 0
        metrics["median"] = 0
        metrics["mean"] = 0
        metrics["quartile3"] = 0
        metrics["max"] = 0
        metrics["iqr"] = 0
        metrics["lowerInnerFence"] = 0
        metrics["upperInnerFence"] = 0
        metrics["lowerOuterFence"] = 0
        metrics["upperOuterFence"] = 0
        return metrics
        
    metrics["count"] = len(values)
    metrics["min"] = np.min(values)
    metrics["quartile1"] = np.percentile(values, 25)
    metrics["median"] = np.median(values)
    metrics["mean"] = np.mean(values)
    metrics["quartile3"] = np.percentile(values, 75)
    metrics["max"] = np.max(values)
    metrics["iqr"] = metrics["quartile3"] - metrics["quartile1"]
    
    LIF = metrics["quartile1"] - 1.5 * metrics["iqr"]
    UIF = metrics["quartile3"] + 1.5 * metrics["iqr"]
    
    for i in values:
        if (i >= LIF and (metrics["lowerInnerFence"]==None or i < metrics["lowerInnerFence"])):
            metrics["lowerInnerFence"] = i
            
        if (i <= UIF and (metrics["upperInnerFence"]==None or i > metrics["upperInnerFence"])): 
            metrics["upperInnerFence"] = i
    
    metrics["lowerOuterFence"] = metrics["quartile1"] - (3 * metrics["iqr"]);
    metrics["upperOuterFence"] = metrics["quartile3"] + (3 * metrics["iqr"]);
    if (metrics["lowerInnerFence"] == None):
        metrics["lowerInnerFence"] = metrics["min"];
        
    if (metrics["upperInnerFence"] == None):
        metrics["upperInnerFence"] = metrics["max"];
        
    return metrics



def stat_info():
    res = {}
    for chpt in range_chapter:
        for feature in feature_name:
            df = df_course.loc[(slice(None), chpt), [feature]].dropna()
            values = np.array(df.loc[df[feature]>0, feature])
            
            metrics = calMetrics(values)
            if values.shape[0] == 0:
                values = []
                domain = [0, 1]
                visible = False;
            else:
                values = values.tolist()
                domain = [0, np.percentile(values, 97)]
                visible = True
            res["{}-{}".format(chpt, feature)] = {"values": values, "metrics": metrics,  "domain": domain, "visible": visible}
    
    return res


def percentileOfScore(val, chpt, feature):
    df = df_course.loc[(slice(None), chpt), [feature]].dropna()
    df = df.loc[df[feature] > 0, feature]
    return stats.percentileofscore(df, val) or 0


def ratioOfMedia(val, chpt, feature):
    pass


stat = stat_info()
