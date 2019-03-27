"""viz_server URL Configuration

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/2.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path

from pandas_api.views import getSummaryByID, getCourseStructure, getFeatureList, getFeatureDetail, getHistFeature, getTwoFeatures, getInfoByID, getFeatureDistro, getFeatureDistroByID, getTargetDistro, requestNNOutput, requestNNAnalysis, genSuggestion, getFeatureInfo
from django.conf import settings
from django.conf.urls.static import static

extra_patterns = [
    path(r'coursestructure/', getCourseStructure),
    path(r'featurelist/', getFeatureList),
    path(r'feature-info/', getFeatureInfo),
    path(r'feature-detail/', getFeatureDetail),
    path(r'hist/chapter-<int:chapter>-<featureName>/', getHistFeature),
    path(r'feature/chapter-<int:chapter1>-<featureName1>/chapter-<int:chapter2>-<featureName2>/', getTwoFeatures),
    path(r'prediction/<platform>/<course_code>/', getSummaryByID),
    path(r'info/sid-<sid>/', getInfoByID),
    path(r'model/feature-distro/', getFeatureDistro),
    path(r'model/feature-distro/<sid>/', getFeatureDistroByID),
    path(r'model/target-distro/', getTargetDistro),
    path(r'model/request/<data>/', requestNNOutput),
    path(r'model/request/analysis/<data>/', requestNNAnalysis),
    path(r'model/request/suggestion/<sid>/<int:chapter>/<int:percentile>/', genSuggestion),
    ] + static("/demo/", document_root=settings.STATIC_ROOT)

urlpatterns = [path('admin/', admin.site.urls),] + extra_patterns
